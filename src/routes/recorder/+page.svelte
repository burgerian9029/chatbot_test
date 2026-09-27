<script>
	import VoiceRecorder from '$lib/VoiceRecorder.svelte';
</script>

<svelte:head>
	<title>음성 녹음기</title>
</svelte:head>

<main class="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-8 sm:py-16">
	<!-- Navigation back to main -->
	<div class="mx-auto max-w-2xl mb-6">
		<a href="/" class="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
			</svg>
			메인으로 돌아가기
		</a>
	</div>
	
	<VoiceRecorder />
</main>
