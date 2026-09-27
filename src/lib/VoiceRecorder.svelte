<script>
	import { onMount } from 'svelte';

	let status = $state('idle'); // 'idle' | 'recording'
	let mediaRecorder = null;
	let audioChunks = [];
	let recordings = $state([]);
	let stream = null;

	// For simple visualizer
	let audioCtx = null;
	let analyser = null;
	let dataArray = null;
	let rafId = null;
	let volume = $state(0);

	function startRecording() {
		navigator.mediaDevices.getUserMedia({ audio: true }).then((mediaStream) => {
			stream = mediaStream;
			mediaRecorder = new MediaRecorder(stream);
			
			// Setup analyzer
			audioCtx = new AudioContext();
			analyser = audioCtx.createAnalyser();
			const source = audioCtx.createMediaStreamSource(stream);
			source.connect(analyser);
			analyser.fftSize = 256;
			dataArray = new Uint8Array(analyser.frequencyBinCount);
			
			function updateVolume() {
				if (!analyser) return;
				analyser.getByteFrequencyData(dataArray);
				let sum = 0;
				for (let i = 0; i < dataArray.length; i++) {
					sum += dataArray[i];
				}
				volume = sum / dataArray.length;
				rafId = requestAnimationFrame(updateVolume);
			}
			updateVolume();

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunks.push(e.data);
				}
			};

			mediaRecorder.onstop = () => {
				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
				const audioUrl = URL.createObjectURL(audioBlob);
				
				// Add to start of list
				recordings = [{ id: Date.now(), url: audioUrl, date: new Date() }, ...recordings];
				audioChunks = [];
				
				// cleanup
				cancelAnimationFrame(rafId);
				if (audioCtx) {
					audioCtx.close().catch(() => {});
					audioCtx = null;
				}
				if (stream) {
					stream.getTracks().forEach(track => track.stop());
					stream = null;
				}
				volume = 0;
			};

			audioChunks = [];
			mediaRecorder.start();
			status = 'recording';
		}).catch((err) => {
			alert('마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
			console.error(err);
		});
	}

	function stopRecording() {
		if (mediaRecorder && status === 'recording') {
			mediaRecorder.stop();
			status = 'idle';
		}
	}
	
	function toggleRecording() {
		if (status === 'idle') {
			startRecording();
		} else {
			stopRecording();
		}
	}

	onMount(() => {
		return () => {
			if (status === 'recording') stopRecording();
		};
	});
</script>

<div class="mx-auto w-full max-w-2xl">
	<div class="rounded-3xl border border-gray-100 bg-white/80 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.05)] backdrop-blur flex flex-col items-center">
		
		<div class="mb-8 text-center">
			<h2 class="text-3xl font-bold tracking-tight text-gray-800">음성 녹음기</h2>
			<p class="mt-2 text-[15px] text-gray-500">마이크 버튼을 눌러 녹음을 시작하고 다시 들어보세요.</p>
		</div>

		<!-- Visualizer & Record Button -->
		<div class="relative mb-8 flex h-48 w-full items-center justify-center">
			{#if status === 'recording'}
				<!-- Pulse rings showing volume -->
				<div 
					class="absolute rounded-full bg-red-100 transition-all duration-75"
					style="width: {120 + volume * 1.5}px; height: {120 + volume * 1.5}px; opacity: {0.3 + (volume / 255)};"
				></div>
				<div 
					class="absolute rounded-full bg-red-200 transition-all duration-75"
					style="width: {100 + volume * 1}px; height: {100 + volume * 1}px; opacity: {0.5 + (volume / 255)};"
				></div>
			{/if}
			
			<button 
				onclick={toggleRecording}
				class="relative z-10 flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 {status === 'recording' ? 'bg-red-500 hover:bg-red-600' : 'bg-red-500 hover:bg-red-600'}"
				aria-label={status === 'recording' ? '녹음 중지' : '녹음 시작'}
			>
				{#if status === 'recording'}
					<div class="h-8 w-8 rounded-sm bg-white shadow-sm"></div>
				{:else}
					<div class="h-10 w-10 text-white">
						<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
							<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
						</svg>
					</div>
				{/if}
			</button>
		</div>

		<!-- Recording Status -->
		<div class="mb-8 text-center text-sm font-medium {status === 'recording' ? 'text-red-500 animate-pulse' : 'text-gray-400'}">
			{status === 'recording' ? '녹음 중...' : '대기 중'}
		</div>

		<!-- Recordings List -->
		<div class="w-full">
			<h3 class="mb-4 text-lg font-semibold text-gray-700">녹음된 목록</h3>
			
			{#if recordings.length === 0}
				<div class="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center text-[15px] text-gray-400">
					아직 녹음된 파일이 없습니다.
				</div>
			{:else}
				<ul class="space-y-3 max-h-80 overflow-y-auto pr-2">
					{#each recordings as record (record.id)}
						<li class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4 border border-gray-100 transition hover:bg-gray-100 shadow-sm">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-inner">
									<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
									</svg>
								</div>
								<div>
									<p class="font-medium text-gray-800 text-sm">녹음 {record.date.toLocaleTimeString()}</p>
									<p class="text-xs text-gray-500 mt-0.5">{record.date.toLocaleDateString()}</p>
								</div>
							</div>
							<audio controls src={record.url} class="h-10 w-full sm:w-64"></audio>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
