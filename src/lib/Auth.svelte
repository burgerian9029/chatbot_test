<script>
	import { auth } from '$lib/firebase';
	import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
	import { onMount } from 'svelte';

	let user = $state(null);
	let loading = $state(true);

	onMount(() => {
		// 현재 로그인 상태를 실시간으로 확인 (새로고침해도 유지됨)
		const unsubscribe = auth.onAuthStateChanged((currentUser) => {
			user = currentUser;
			loading = false;
		});
		return unsubscribe;
	});

	async function loginWithGoogle() {
		try {
			const provider = new GoogleAuthProvider();
			await signInWithPopup(auth, provider);
		} catch (error) {
			console.error("로그인 에러:", error);
			alert("로그인 중 문제가 발생했습니다.");
		}
	}

	async function logout() {
		try {
			await signOut(auth);
		} catch (error) {
			console.error("로그아웃 에러:", error);
		}
	}
</script>

<div class="fixed top-4 right-4 z-50">
	{#if loading}
		<div class="h-10 w-24 animate-pulse rounded-full bg-gray-200"></div>
	{:else if user}
		<div class="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-md border border-gray-100">
			<img src={user.photoURL} alt="프로필" class="h-6 w-6 rounded-full" />
			<span class="text-sm font-medium text-gray-700">{user.displayName}님</span>
			<button
				onclick={logout}
				class="ml-2 text-xs text-gray-400 hover:text-gray-600 font-medium"
			>
				로그아웃
			</button>
		</div>
	{:else}
		<button
			onclick={loginWithGoogle}
			class="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-md transition-transform hover:scale-105 border border-gray-100"
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24">
				<path
					fill="#4285F4"
					d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				/>
				<path
					fill="#34A853"
					d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				/>
				<path
					fill="#FBBC05"
					d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				/>
				<path
					fill="#EA4335"
					d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				/>
			</svg>
			로그인
		</button>
	{/if}
</div>
