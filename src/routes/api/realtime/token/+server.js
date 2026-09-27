import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { GoogleGenAI } from '@google/genai';

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

	try {
		const client = new GoogleGenAI({ apiKey });
		
		const token = await client.authTokens.create({
			config: {
				uses: 1,
				expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
				newSessionExpireTime: new Date(Date.now() + 1 * 60 * 1000).toISOString(),
			},
		});

		return json({
			value: token.name,
			expires_at: Date.now() + 30 * 60 * 1000
		});
	} catch (err) {
		console.error("Token creation failed:", err);
		return json({ error: '임시 토큰 생성에 실패했습니다.' }, { status: 500 });
	}
}
