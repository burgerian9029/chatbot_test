<script>
	import { onMount } from 'svelte';
	import { connectRealtime } from '$lib/realtimeClient.js';
	import { db, auth } from '$lib/firebase';
	import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

	/** @type {HTMLCanvasElement | undefined} */
	let canvasEl;
	/** @type {HTMLDivElement | undefined} */
	let transcriptEl;

	let status = $state(/** @type {'idle' | 'connecting' | 'live'} */ ('idle'));
	let error = $state('');
	let userSpeaking = $state(false);
	let elapsedMs = $state(0);
	/** @type {{ id: string; role: 'user' | 'assistant'; text: string }[]} */
	let messages = $state([]);

	let timerId = 0;
	let rafId = 0;
	let nextId = 0;
	/** @type {AudioContext | null} */
	let audioCtx = null;
	/** @type {AnalyserNode | null} */
	let analyser = null;
	/** @type {null | { disconnect: () => void; localStream: MediaStream }} */
	let session = null;

	let currentUser = $state(null);
	let authLoaded = $state(false);
	let showLoginTooltip = $state(false);

	const isLive = $derived(status === 'live');
	const isBusy = $derived(status === 'connecting');

	const statusLabel = $derived(
		status === 'connecting' ? '연결 중...' : status === 'live' ? '대화 중' : '연결 대기 중'
	);

	function drawWaveform() {
		const canvas = canvasEl;
		if (!canvas || !analyser) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const buffer = new Uint8Array(analyser.fftSize);
		analyser.getByteTimeDomainData(buffer);

		const { width, height } = canvas;
		ctx.clearRect(0, 0, width, height);

		const gradient = ctx.createLinearGradient(0, 0, width, 0);
		gradient.addColorStop(0, '#60b6ff');
		gradient.addColorStop(0.5, '#d78bfd');
		gradient.addColorStop(1, '#ff8be6');
		
		ctx.strokeStyle = gradient;
		ctx.lineWidth = 4;
		ctx.lineCap = 'round';
		ctx.beginPath();

		const slice = width / buffer.length;
		let x = 0;
		for (let i = 0; i < buffer.length; i += 1) {
			const v = buffer[i] / 128;
			const y = (v * height) / 2;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
			x += slice;
		}
		ctx.stroke();

		rafId = requestAnimationFrame(drawWaveform);
	}

	/**
	 * @param {MediaStream} mediaStream
	 */
	function startAnalyser(mediaStream) {
		audioCtx = new AudioContext();
		analyser = audioCtx.createAnalyser();
		analyser.fftSize = 2048;
		const source = audioCtx.createMediaStreamSource(mediaStream);
		source.connect(analyser);
		drawWaveform();
	}

	function stopVisualizers() {
		cancelAnimationFrame(rafId);
		if (audioCtx) {
			audioCtx.close().catch(() => {});
			audioCtx = null;
			analyser = null;
		}
	}

	function startTimer() {
		const started = Date.now();
		elapsedMs = 0;
		timerId = window.setInterval(() => {
			elapsedMs = Date.now() - started;
		}, 200);
	}

	function clearTimer() {
		clearInterval(timerId);
		elapsedMs = 0;
	}

	function scrollTranscript() {
		requestAnimationFrame(() => {
			if (transcriptEl) transcriptEl.scrollTop = transcriptEl.scrollHeight;
		});
	}

	function appendAssistantDelta(delta) {
		const last = messages.at(-1);
		if (last?.role === 'assistant') {
			messages = [...messages.slice(0, -1), { ...last, text: last.text + delta }];
		} else {
			messages = [...messages, { id: `a-${nextId++}`, role: 'assistant', text: delta }];
		}
		scrollTranscript();
	}

	async function startConversation() {
		error = '';
		status = 'connecting';
		messages = [];
		userSpeaking = false;

		try {
			session = await connectRealtime({
				onReady() {
					status = 'live';
				},
				onUserTranscript(transcript) {
					messages = [...messages, { id: `u-${nextId++}`, role: 'user', text: transcript }];
					scrollTranscript();
				},
				onAssistantStart() {
					const last = messages.at(-1);
					if (last?.role !== 'assistant' || last.text) {
						messages = [...messages, { id: `a-${nextId++}`, role: 'assistant', text: '' }];
						scrollTranscript();
					}
				},
				onAssistantDelta: appendAssistantDelta,
				onSpeechStart() {
					userSpeaking = true;
				},
				onSpeechStop() {
					userSpeaking = false;
				},
				onError(message) {
					error = message;
				}
			});

			startAnalyser(session.localStream);
			startTimer();
			status = 'live';
		} catch (err) {
			stopConversation();
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				error = '마이크 권한이 필요합니다. 브라우저 설정에서 허용한 뒤 다시 시도해 주세요.';
			} else {
				error = err instanceof Error ? err.message : '회화를 시작하지 못했습니다.';
			}
		}
	}

	async function stopConversation() {
		session?.disconnect();
		session = null;
		userSpeaking = false;
		clearTimer();
		stopVisualizers();
		status = 'idle';

		// 대화 내용이 있고 로그인이 되어 있다면 Firestore에 저장
		if (messages.length > 0 && auth.currentUser) {
			try {
				await addDoc(collection(db, 'conversations'), {
					userId: auth.currentUser.uid,
					timestamp: serverTimestamp(),
					durationMs: elapsedMs,
					messages: messages.map(m => ({ role: m.role, text: m.text }))
				});
				console.log("대화 기록이 성공적으로 저장되었습니다.");
			} catch (err) {
				console.error("대화 기록 저장 실패:", err);
			}
		}
	}

	function toggleConversation() {
		if (status === 'connecting') return;
		
		if (!currentUser) {
			showLoginTooltip = true;
			setTimeout(() => showLoginTooltip = false, 3000);
			return;
		}

		if (isLive) stopConversation();
		else startConversation();
	}

	onMount(() => {
		const unsubscribe = auth.onAuthStateChanged(u => {
			currentUser = u;
			authLoaded = true;
		});
		return () => {
			stopConversation();
			unsubscribe();
		};
	});
</script>

<section class="mx-auto flex w-full max-w-md flex-col items-center justify-center bg-white px-6 py-12 shadow-2xl shadow-blue-500/5 sm:rounded-[40px] sm:border sm:border-gray-50">
	<!-- Header -->
	<div class="mb-12 text-center">
		<h1 class="text-2xl font-bold text-gray-800 tracking-tight flex items-center justify-center gap-2">
			🎤 AI 영어회화 선생님
		</h1>
		<p class="mt-2 text-sm text-gray-400 font-medium">실시간으로 원어민과 대화를 연습해보세요</p>
	</div>

	<!-- Central Visualizer / Mic -->
	<div class="relative mb-10 flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-tr from-[#60b6ff] via-[#d78bfd] to-[#ff8be6] p-[6px] shadow-lg shadow-purple-200/50">
		<div class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
			{#if isLive}
				<!-- Canvas will draw the wave -->
				<canvas bind:this={canvasEl} class="absolute inset-0 h-full w-full opacity-90" width="180" height="180"></canvas>
			{:else}
				<svg class="h-28 w-28 text-[#bc95f5]" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
					<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
				</svg>
			{/if}
		</div>
	</div>

	<!-- Status -->
	<div class="mb-10 flex items-center gap-2 text-sm font-medium text-[#bc95f5]">
		<span class="flex h-2 w-2 rounded-full {isLive ? 'bg-green-400 animate-pulse' : 'bg-[#bc95f5]/40'}"></span>
		{statusLabel}
	</div>

	<!-- Main Action Button -->
	<div class="relative w-full mb-10">
		{#if showLoginTooltip}
			<div class="absolute -top-14 left-1/2 -translate-x-1/2 rounded-xl bg-gray-800 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg animate-fade-in z-10 whitespace-nowrap">
				대화를 시작하려면 우측 상단에서 로그인해 주세요!
				<!-- 툴팁 꼬리 -->
				<div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
			</div>
		{/if}
		<button
			type="button"
			class="w-full rounded-full bg-gradient-to-r from-[#20b8ff] to-[#00dbff] py-4 text-[15px] font-bold text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
			onclick={toggleConversation}
			disabled={isBusy}
		>
			{#if authLoaded && !currentUser}
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			{:else if isLive}
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M6 6h12v12H6z" />
				</svg>
			{:else if isBusy}
				<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
				</svg>
			{:else}
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M8 5v14l11-7z" />
				</svg>
			{/if}
			{isLive ? '연결 종료하기' : isBusy ? '연결 중...' : 'AI 선생님과 연결하기'}
		</button>
	</div>

	<!-- Content Area: Guide vs Transcript -->
	{#if isLive || messages.length > 0}
		<div class="w-full flex-1 animate-fade-in">
			<div
				bind:this={transcriptEl}
				class="h-64 w-full scroll-smooth overflow-y-auto rounded-3xl bg-gray-50/80 p-5 text-sm shadow-inner"
			>
				{#if messages.length === 0}
					<p class="text-center text-gray-400 mt-20">인사말을 기다리고 있습니다...</p>
				{/if}
				<ul class="space-y-4">
					{#each messages as message (message.id)}
						<li class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
							<div
								class="max-w-[90%] rounded-2xl px-4 py-3 shadow-sm leading-relaxed {message.role === 'user'
									? 'bg-[#20b8ff] text-white rounded-tr-sm'
									: 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'}"
							>
								<p class="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-80 {message.role === 'user' ? 'text-blue-100' : 'text-blue-500'}">
									{message.role === 'user' ? 'You' : 'AI Teacher'}
								</p>
								<p>{message.text || '...'}</p>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{:else}
		<div class="w-full text-left animate-fade-in">
			<h2 class="mb-5 flex items-center gap-2 text-sm font-bold text-[#60b6ff]">
				<span>📝</span> 사용 방법
			</h2>
			<ul class="space-y-4 text-[13px] text-[#60b6ff]/80">
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60b6ff]/50"></span>
					'AI 선생님과 연결하기' 버튼을 클릭하세요
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60b6ff]/50"></span>
					마이크 사용 권한을 허용해주세요
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60b6ff]/50"></span>
					연결되면 자유롭게 영어로 대화해보세요
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60b6ff]/50"></span>
					AI가 발음과 문법을 교정해드립니다
				</li>
			</ul>
		</div>
	{/if}

	{#if error}
		<p class="mt-6 w-full rounded-2xl bg-red-50 p-4 text-center text-sm font-medium text-red-500">{error}</p>
	{/if}
</section>

<style>
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(5px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.animate-fade-in {
		animation: fade-in 0.3s ease-out forwards;
	}
</style>
