<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Auth from '$lib/Auth.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Auth />
{@render children()}
