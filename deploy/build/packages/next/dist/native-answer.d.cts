interface ConversationRecordWithAnswers {
    answers: Array<{
        type: string;
        tts?: {
            text?: string;
        };
        llm?: {
            text?: string;
        };
    }>;
}
interface NativeAnswer {
    text: string;
    type: 'TTS' | 'LLM';
}
/** Extract the text XiaoAI already generated for a conversation record. */
declare function extractNativeAnswer(record: ConversationRecordWithAnswers): NativeAnswer | undefined;

export { type NativeAnswer, extractNativeAnswer };
