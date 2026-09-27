import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

export async function POST() {
	// 기존 OPENAI_API_KEY를 재사용하거나 새로 추가한 GEMINI_API_KEY를 사용합니다.
	const apiKey = env.GEMINI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim();

	if (!apiKey) {
		return json(
			{
				error:
					'API 키가 없습니다. 프로젝트 루트에 .env 파일을 만들고 GEMINI_API_KEY를 넣은 뒤 개발 서버를 다시 시작해 주세요.'
			},
			{ status: 500 }
		);
	}

	// 로컬 테스트용이므로, API 키를 직접 브라우저로 내려주어 Gemini SDK가 쓰도록 합니다.
	// 실제 운영 환경에서는 Ephemeral Token을 발급받아 사용하는 것이 안전합니다.
	return json({
		value: apiKey,
		expires_at: Date.now() + 3600000
	});
}
