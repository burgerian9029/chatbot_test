<script>
	import { db, auth } from '$lib/firebase';
	import { collection, query, where, getDocs } from 'firebase/firestore';
	import { onMount } from 'svelte';

	let conversations = $state([]);
	let loading = $state(true);
	let error = $state('');

	onMount(() => {
		const unsubscribe = auth.onAuthStateChanged((user) => {
			if (user) {
				fetchHistory(user.uid);
			} else {
				loading = false;
				error = '로그인이 필요합니다. 우측 상단에서 로그인해주세요.';
			}
		});
		return unsubscribe;
	});

	async function fetchHistory(uid) {
		try {
			const q = query(
				collection(db, 'conversations'),
				where('userId', '==', uid)
			);
			const querySnapshot = await getDocs(q);
			
			let results = querySnapshot.docs.map(doc => ({
				id: doc.id,
				...doc.data(),
				expanded: false
			}));

			// 최신순 정렬
			results.sort((a, b) => {
				const timeA = a.timestamp?.toMillis() || 0;
				const timeB = b.timestamp?.toMillis() || 0;
				return timeB - timeA;
			});

			conversations = results;
		} catch (err) {
			console.error(err);
			error = '기록을 불러오는데 실패했습니다.';
		} finally {
			loading = false;
		}
	}

	function formatDate(timestamp) {
		if (!timestamp) return '알 수 없는 시간';
		const date = timestamp.toDate();
		return new Intl.DateTimeFormat('ko-KR', {
			month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
		}).format(date);
	}

	function formatDuration(ms) {
		const totalSeconds = Math.floor(ms / 1000);
		const m = Math.floor(totalSeconds / 60);
		const s = totalSeconds % 60;
		return `${m}분 ${s}초`;
	}
</script>

<svelte:head>
	<title>나의 대화 기록 | Realtime English</title>
</svelte:head>

<main class="min-h-screen bg-gray-50 px-4 pt-20 pb-10 sm:px-8 sm:pt-24 sm:pb-16">
	<div class="mx-auto max-w-2xl">
		<div class="mb-8 flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl sm:text-3xl font-bold text-gray-800">나의 대화 기록 📚</h1>
				<p class="mt-2 text-sm sm:text-base text-gray-500">AI 선생님과 연습했던 내용을 복습해보세요.</p>
			</div>
			<a href="/" class="shrink-0 whitespace-nowrap rounded-full bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-blue-500 shadow-sm transition hover:bg-gray-50 border border-gray-100">
				돌아가기
			</a>
		</div>

		{#if loading}
			<div class="flex h-40 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500"></div>
			</div>
		{:else if error}
			<div class="rounded-2xl bg-red-50 p-6 text-center text-red-500">{error}</div>
		{:else if conversations.length === 0}
			<div class="rounded-3xl bg-white p-10 text-center shadow-sm">
				<p class="text-gray-500">아직 대화 기록이 없습니다.<br/>AI 선생님과 첫 대화를 시작해보세요!</p>
				<a href="/" class="mt-4 inline-block rounded-full bg-blue-500 px-6 py-2 text-white hover:bg-blue-600">
					대화하러 가기
				</a>
			</div>
		{:else}
			<div class="space-y-4">
				{#each conversations as conv}
					<div class="overflow-hidden rounded-2xl bg-white shadow-sm transition-all border border-gray-100">
						<!-- Card Header (Click to expand) -->
						<button
							class="flex w-full items-center justify-between p-5 text-left hover:bg-gray-50/50"
							onclick={() => conv.expanded = !conv.expanded}
						>
							<div>
								<h3 class="font-semibold text-gray-800">{formatDate(conv.timestamp)}</h3>
								<p class="text-sm text-gray-400 mt-1">대화 시간: {formatDuration(conv.durationMs)} · 메시지 {conv.messages.length}개</p>
							</div>
							<div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500">
								{#if conv.expanded}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
								{:else}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
								{/if}
							</div>
						</button>

						<!-- Card Body (Transcript) -->
						{#if conv.expanded}
							<div class="border-t border-gray-50 bg-gray-50/30 p-5">
								<ul class="space-y-3">
									{#each conv.messages as msg, i}
										<li class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
											<div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm {msg.role === 'user' ? 'bg-[#20b8ff] text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'}">
												<p class="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-80 {msg.role === 'user' ? 'text-blue-100' : 'text-blue-500'}">
													{msg.role === 'user' ? 'You' : 'AI Teacher'}
												</p>
												<p class="leading-relaxed">{msg.text}</p>
											</div>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</main>
