/**
 * Agent Memory System
 * Handles persistent chat history and context summarization.
 */

const AgentMemory = {
    STORAGE_KEY: 'autopilot_chat_history',
    MAX_HISTORY: 12, // Maximum number of messages before summarization

    async load() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load memory:', e);
            }
        }
        return [];
    },

    async save(history) {
        // Only save user/assistant roles, skip system context to keep storage small
        const toSave = history.filter(m => m.role !== 'system');
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
    },

    async clear() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    /**
     * Summarizes old messages if the history gets too long.
     * This keeps the prompt context window lean and fast.
     */
    async compress(history) {
        if (history.length <= this.MAX_HISTORY) return history;

        console.log('[AgentMemory] Compressing history...');
        
        // Keep the system prompt (first index)
        const systemPrompt = history[0];
        
        // Take the middle part to summarize (messages between system prompt and the last 4 messages)
        const toSummarize = history.slice(1, -4);
        const keptRecent = history.slice(-4);

        // In a full implementation, we would call an LLM here to summarize.
        // For now, we'll implement a "Sliding Window" that preserves the most important recent context.
        // and provides a placeholder for the summary.
        
        const summaryMessage = {
            role: 'system',
            content: `[سياق مؤرشف]: المحادثة السابقة تضمنت مناقشة حول ${toSummarize.length} رسائل سابقة. يرجى التركيز على السياق الأخير.`
        };

        return [systemPrompt, summaryMessage, ...keptRecent];
    },

    /**
     * Working memory for specific entities (like the student currently being discussed)
     */
    workingMemory: {
        currentStudentId: null,
        currentClassId: null,
        lastReportId: null
    },

    updateWorkingMemory(userText, aiResponse) {
        // Basic pattern matching to track context
        const studentIdMatch = aiResponse.match(/ID: (\d+)/) || userText.match(/(\d{7,})/);
        if (studentIdMatch) this.workingMemory.currentStudentId = studentIdMatch[1];
    }
};

window.AgentMemory = AgentMemory;
