<script>
	import VoiceStudio from '$lib/VoiceStudio.svelte';
</script>

<svelte:head>
	<title>실시간 영어회화</title>
</svelte:head>

<main class="min-h-screen bg-gray-50 px-4 py-10 sm:px-8 sm:py-16 flex flex-col">
	<!-- Navigation to Voice Recorder & History -->
	<div class="mx-auto max-w-3xl mb-4 flex justify-start gap-2 w-full">
		<a href="/history" class="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-blue-500 shadow-sm hover:bg-white transition-colors border border-gray-100/50">
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			기록 보기
		</a>
	</div>
	
	<VoiceStudio />
</main>
