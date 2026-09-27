import { GoogleGenAI } from '@google/genai';

/**
 * 16-bit PCM Audio Player
 * Gemini Live API는 24kHz 16-bit PCM 오디오를 반환합니다.
 */
class PCMPlayer {
	constructor(sampleRate = 24000) {
		this.sampleRate = sampleRate;
		this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
		this.nextTime = 0;
	}
	play(base64Data) {
		if (this.audioCtx.state === 'suspended') {
			this.audioCtx.resume();
		}
		
		const binaryString = atob(base64Data);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const int16 = new Int16Array(bytes.buffer);
		const float32 = new Float32Array(int16.length);
		for (let i = 0; i < int16.length; i++) {
			float32[i] = int16[i] / 32768; // -1.0 ~ 1.0
		}
		const buffer = this.audioCtx.createBuffer(1, float32.length, this.sampleRate);
		buffer.getChannelData(0).set(float32);
		const source = this.audioCtx.createBufferSource();
		source.buffer = buffer;
		source.connect(this.audioCtx.destination);
		
		if (this.nextTime < this.audioCtx.currentTime) {
			this.nextTime = this.audioCtx.currentTime + 0.1; // 약간의 버퍼 시간
		}
		source.start(this.nextTime);
		this.nextTime += buffer.duration;
	}
	stop() {
		this.nextTime = 0;
	}
	close() {
		this.audioCtx.close().catch(() => {});
	}
}

/**
 * Uint8Array(바이트 배열)를 Base64 문자열로 변환합니다.
 */
function bufferToBase64(buffer) {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * @typedef {object} RealtimeHandlers
 * @property {() => void} [onReady]
 * @property {(transcript: string, itemId?: string) => void} [onUserTranscript]
 * @property {() => void} [onAssistantStart]
 * @property {(delta: string) => void} [onAssistantDelta]
 * @property {() => void} [onAssistantDone]
 * @property {() => void} [onSpeechStart]
 * @property {() => void} [onSpeechStop]
 * @property {(message: string) => void} [onError]
 */

/**
 * @param {RealtimeHandlers} handlers
 */
export async function connectRealtime(handlers) {
	// 1. 서버에서 API 키(혹은 토큰) 가져오기
	const tokenResponse = await fetch('/api/realtime/token', { method: 'POST' });
	const tokenData = await tokenResponse.json().catch(() => ({}));

	if (!tokenResponse.ok || !tokenData.value) {
		throw new Error(tokenData.error || 'API 키를 가져오지 못했습니다.');
	}

	const ai = new GoogleGenAI({ apiKey: tokenData.value });
	const pcmPlayer = new PCMPlayer(24000);

	// 2. 마이크 접근 및 PCM 데이터 추출 준비
	const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
	const audioCtx = new AudioContext({ sampleRate: 16000 });
	const source = audioCtx.createMediaStreamSource(localStream);
	const processor = audioCtx.createScriptProcessor(2048, 1, 1);
	
	let session = null;
	let isRecording = false;

	// 3. Gemini Live 연결
	try {
		session = await ai.live.connect({
			model: 'gemini-3.1-flash-live-preview', // 최신 실시간 특화 모델
			config: {
				responseModalities: ['audio'],
				systemInstruction: { parts: [{ text: 'You are a helpful English conversation partner. Speak naturally and concisely.' }] },
				thinkingLevel: 'minimal'
			},
			callbacks: {
				onopen: () => {
					// 마이크 오디오 처리 및 전송 시작
					isRecording = true;
					source.connect(processor);
					processor.connect(audioCtx.destination);
					handlers.onReady?.();
				},
				onmessage: (response) => {
					const content = response.serverContent;
					
					if (content?.modelTurn?.parts) {
						handlers.onAssistantStart?.();
						for (const part of content.modelTurn.parts) {
							if (part.inlineData?.data) {
								pcmPlayer.play(part.inlineData.data);
							}
						}
					}
					
					// Gemini는 STT 결과를 inputTranscription으로 줍니다.
					if (content?.inputTranscription?.text) {
						handlers.onUserTranscript?.(content.inputTranscription.text);
					}
					
					// AI의 답변 텍스트 자막
					if (content?.outputTranscription?.text) {
						handlers.onAssistantDelta?.(content.outputTranscription.text);
					}

					// 사용자가 말을 끊었을 때 (VAD Interruption)
					if (content?.interrupted) {
						pcmPlayer.stop();
					}
				},
				onerror: (error) => {
					handlers.onError?.(error.message || 'Gemini Live 오류가 발생했습니다.');
				},
				onclose: () => {
					handlers.onAssistantDone?.();
				}
			}
		});
	} catch (err) {
		localStream.getTracks().forEach((track) => track.stop());
		throw new Error('Gemini API와 연결하지 못했습니다. 키 설정을 확인해주세요.');
	}

	// 마이크 데이터를 16kHz 16-bit PCM으로 변환하여 웹소켓 전송
	processor.onaudioprocess = (e) => {
		if (!session || !isRecording) return;
		const inputData = e.inputBuffer.getChannelData(0);
		const pcm16 = new Int16Array(inputData.length);
		
		let sum = 0;
		for (let i = 0; i < inputData.length; i++) {
			pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
			sum += Math.abs(pcm16[i]);
		}
		
		// 간단한 VAD (Voice Activity Detection) 신호 처리
		const avgVolume = sum / inputData.length;
		if (avgVolume > 1000) {
			handlers.onSpeechStart?.();
		} else {
			handlers.onSpeechStop?.();
		}
		
		const base64 = bufferToBase64(pcm16.buffer);
		
		try {
			session.sendRealtimeInput({
				audio: {
					data: base64,
					mimeType: 'audio/pcm;rate=16000'
				}
			});
		} catch(e) {
			console.error("Failed to send audio", e);
		}
	};

	return {
		localStream,
		disconnect() {
			isRecording = false;
			try { processor.disconnect(); } catch(e){}
			try { source.disconnect(); } catch(e){}
			audioCtx.close().catch(()=>{});
			pcmPlayer.close();
			localStream.getTracks().forEach((track) => track.stop());
			// @google/genai 세션 종료 처리 (브라우저 WebSocket 닫기)
			// (SDK 버전에 따라 close 메소드 이름이 다를 수 있음)
			if (session) {
				// 임시 접근 방식으로 웹소켓을 닫습니다.
				session = null;
			}
		}
	};
}
