<script>
	import VoiceStudio from '$lib/VoiceStudio.svelte';
</script>

<svelte:head>
	<title>실시간 영어회화</title>
</svelte:head>

<main class="min-h-screen bg-gray-50 px-4 py-10 sm:px-8 sm:py-16 flex flex-col">
	<!-- Navigation to Voice Recorder -->
	<div class="mx-auto max-w-3xl mb-6 text-right">
		<a href="/recorder" class="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm font-medium text-[#c45c26] shadow-sm hover:bg-white transition-colors">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
			</svg>
			음성 녹음기(테스트) 가기
		</a>
	</div>
	
	<VoiceStudio />
</main>
