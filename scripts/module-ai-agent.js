/**
 * AI Agent - Modular Architecture Upgrade
 * Optimized for low-end hardware (i3/8GB) and advanced agentic capabilities.
 */

const Agent = {
    config: {
        emailjsKey: "HNz0UjJRVZpAN8unm",
        emailjsService: "service_qtnp6zk",
        emailjsTemplate: "template_a11cl9r",
        provider: 'openrouter' // Switched to OpenRouter as default for better reliability
    },
    chatHistory: [],
    isOpen: false,
    isStreaming: false,
    cachedContext: null,
    lastContextUpdate: 0,

    async init() {
        if (typeof emailjs !== 'undefined') emailjs.init(this.config.emailjsKey);
        if (typeof GmailManager !== 'undefined') await GmailManager.init();
        
        // Load persistent memory
        if (window.AgentMemory) {
            this.chatHistory = await AgentMemory.load();
        }

        this.UI.renderToggle();
        
        // Initial system prompt setup
        const systemPrompt = { role: 'system', content: await this.Brain.getSystemContext() };
        if (this.chatHistory.length === 0 || this.chatHistory[0].role !== 'system') {
            this.chatHistory.unshift(systemPrompt);
        } else {
            this.chatHistory[0] = systemPrompt;
        }
    }
};

/** 🧠 Brain Module: Handles Logic & Data */
Agent.Brain = {
    async getSystemContext(forceRefresh = false) {
        // Optimization: Cache context for 5 minutes unless forced
        const now = Date.now();
        if (!forceRefresh && Agent.cachedContext && (now - Agent.lastContextUpdate < 300000)) {
            return Agent.cachedContext;
        }

        try {
            const [students, classes, records, teachers, instructionTemplate] = await Promise.all([
                DB.getStudents(), DB.getClasses(), DB.getRecords(), DB.getTeachers(),
                fetch('agent-instructions.md?v=' + now).then(r => r.text())
            ]);

            const currentUser = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : { name: 'مدير النظام', id: '1' };
            const todayStr = new Date().toISOString().split('T')[0];
            const todayHuman = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // Optimized single-pass aggregation (performance-engineer)
            let presentToday = 0, absentToday = 0;
            const studentCounts = {};
            const todayReports = [];

            records.forEach(report => {
                const isToday = report.date === todayStr;
                if (isToday) todayReports.push(report);
                if (report.details) {
                    report.details.forEach(d => {
                        if (!studentCounts[d.studentId]) studentCounts[d.studentId] = { present: 0, total: 0 };
                        studentCounts[d.studentId].total++;
                        if (d.status === 'present') {
                            studentCounts[d.studentId].present++;
                            if (isToday) presentToday++;
                        } else if (d.status === 'absent' && isToday) {
                            absentToday++;
                        }
                    });
                }
            });

            // Map and filter lists (performance-engineer)
            const studentsList = students.slice(0, 100).map(s => { // Limit list for initial context
                const stats = studentCounts[s.id] || { present: 0, total: 0 };
                const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
                return `• ${s.name} | ID: ${s.academicId} | الفصل: ${s.classId} | النسبة: ${rate}%`;
            }).join('\n');

            const classesList = classes.map(c => `• ${c.name} | ID: ${c.id}`).join('\n');
            const recentReports = records.slice(-5).reverse().map(r => `• ID: ${r.id} | التاريخ: ${r.date} | الطلاب: ${r.details?.length || 0}`).join('\n');

            let finalPrompt = instructionTemplate
                .replace(/{{USER_NAME}}/g, currentUser.name)
                .replace(/{{USER_ID}}/g, currentUser.id)
                .replace(/{{TODAY_HUMAN}}/g, todayHuman)
                .replace(/{{TODAY_STR}}/g, todayStr)
                .replace(/{{TOTAL_STUDENTS}}/g, students.length)
                .replace(/{{PRESENT_TODAY}}/g, presentToday)
                .replace(/{{ABSENT_TODAY}}/g, absentToday)
                .replace(/{{TOTAL_RECORDS}}/g, records.length)
                .replace(/{{RECENT_REPORTS}}/g, recentReports)
                .replace(/{{STUDENTS_LIST}}/g, studentsList)
                .replace(/{{CLASSES_LIST}}/g, classesList)
                .replace(/{{TEACHERS_LIST}}/g, teachers.map(t => `• ${t.name} | ID: ${t.id}`).join('\n'));

            // Inject dynamic skills (agent-orchestrator)
            if (window.AgentSkills) {
                finalPrompt += await AgentSkills.getActiveInstructions();
            }

            Agent.cachedContext = finalPrompt;
            Agent.lastContextUpdate = now;
            return finalPrompt;
        } catch (e) {
            console.error('Brain Context Error:', e);
            return 'نظام الحضور والغياب قيد التشغيل.';
        }
    },

    async callAI(messages) {
        const providers = {
            openrouter: {
                url: "https://openrouter.ai/api/v1/chat/completions",
                key: typeof Gemini !== 'undefined' ? Gemini.getOpenRouterKey() : '',
                body: { model: "google/gemini-2.0-flash-001" } // Performance: Fast & capable
            }
        };

        const current = providers[Agent.config.provider];
        const response = await fetch(current.url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${current.key}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages,
                temperature: 0.1,
                ...current.body
            })
        });

        if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
};

/** 🎨 UI Module: Handles Rendering & Events */
Agent.UI = {
    renderToggle() {
        if (document.getElementById('agent-fab')) return;
        
        const fab = document.createElement('div');
        fab.id = 'agent-fab';
        fab.className = 'liquid-glass liquid-glass-interactive fixed bottom-6 left-6 w-14 h-14 rounded-2xl z-[100] flex items-center justify-center transition-all shadow-xl cursor-pointer';
        fab.innerHTML = `<span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1;">smart_toy</span>`;
        fab.onclick = () => Agent.UI.toggleChat();
        document.body.appendChild(fab);

        const container = document.createElement('div');
        container.id = 'agent-container';
        container.className = 'hidden fixed bottom-24 left-4 right-4 h-[75vh] z-[100] bg-white rounded-[2.5rem] border border-gray-100 flex flex-col shadow-2xl transition-all duration-400 opacity-0 translate-y-4 max-w-lg lg:left-6 lg:right-auto lg:w-[400px]';
        container.innerHTML = `
            <div class="px-6 py-5 flex justify-between items-center border-b border-gray-50 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings:'FILL' 1">auto_awesome</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm leading-tight">AutoPilot AI</h3>
                        <div id="agent-status" class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">متصل وجاهز</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="agent-clear-btn" class="w-8 h-8 rounded-xl hover:bg-gray-50 flex items-center justify-center text-gray-400 transition-all"><span class="material-symbols-outlined text-sm">delete_sweep</span></button>
                    <button onclick="Agent.UI.toggleChat()" class="text-gray-400 hover:text-gray-800 transition-colors"><span class="material-symbols-outlined">close</span></button>
                </div>
            </div>
            <div id="agent-messages" class="flex-1 overflow-y-auto p-5 space-y-4 hide-scrollbar"></div>
            <div class="p-4 bg-gray-50/50 shrink-0 rounded-b-[2.5rem]">
                <div class="relative flex items-center gap-2">
                    <textarea id="agent-input" placeholder="كيف يمكنني مساعدتك اليوم؟" class="flex-1 bg-white border border-gray-200 rounded-2xl px-5 py-3 text-xs focus:outline-none focus:border-primary/50 text-gray-800 resize-none max-h-32" rows="1"></textarea>
                    <button id="agent-send-btn" onclick="Agent.UI.sendMessage()" class="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center active:scale-90 transition-transform shrink-0"><span class="material-symbols-outlined text-sm">send</span></button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
        this._setupListeners();
        this._injectStyles();
    },

    toggleChat() {
        Agent.isOpen = !Agent.isOpen;
        const container = document.getElementById('agent-container');
        if (Agent.isOpen) {
            container.classList.remove('hidden');
            setTimeout(() => { 
                container.classList.add('opacity-100', 'translate-y-0'); 
                container.style.transform = 'translateY(0)'; 
            }, 10);
            document.getElementById('agent-input')?.focus();
            if (document.getElementById('agent-messages').children.length === 0) {
                this.addMessage('أهلاً بك! أنا مساعدك الذكي. كيف يمكنني مساعدتك في بيانات الحضور اليوم؟', 'ai');
            }
        } else {
            container.classList.remove('opacity-100', 'translate-y-0');
            setTimeout(() => container.classList.add('hidden'), 400);
        }
    },

    clearChat() {
        document.getElementById('agent-messages').innerHTML = '';
        Agent.chatHistory = [Agent.chatHistory[0]];
        if (window.AgentMemory) AgentMemory.clear();
    },

    handleFileUpload(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        this.addMessage(`📎 تم إرفاق الملف: ${file.name}`, 'user');
        
        // Placeholder for advanced processing (e.g. OCR or data import)
        setTimeout(() => {
            this.addMessage(`لقد استلمت الملف "${file.name}". هل تريد مني تحليله أو البحث عن بيانات معينة داخله؟`, 'ai');
        }, 800);
        
        input.value = '';
    },

    async sendMessage() {
        if (Agent.isStreaming) return;
        const input = document.getElementById('agent-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        this.addMessage(text, 'user');
        const loadingDiv = this.addLoadingIndicator();
        Agent.isStreaming = true;

        try {
            // Update context before sending
            const ctx = await Agent.Brain.getSystemContext();
            Agent.chatHistory[0].content = ctx;
            Agent.chatHistory.push({ role: 'user', content: text });

            // Memory Optimization (agent-memory-systems)
            if (window.AgentMemory) {
                Agent.chatHistory = await AgentMemory.compress(Agent.chatHistory);
                await AgentMemory.save(Agent.chatHistory);
            }

            const response = await Agent.Brain.callAI(Agent.chatHistory);
            Agent.chatHistory.push({ role: 'assistant', content: response });
            
            loadingDiv.remove();
            await Agent.Commands.handleResponse(response);
            
            if (window.AgentMemory) {
                AgentMemory.updateWorkingMemory(text, response);
                await AgentMemory.save(Agent.chatHistory);
            }
        } catch (e) {
            if (loadingDiv) loadingDiv.remove();
            this.addMessage(`⚠️ حدث خطأ: ${e.message}`, 'ai');
        } finally {
            Agent.isStreaming = false;
        }
    },

    addMessage(text, role) {
        const messages = document.getElementById('agent-messages');
        if (!messages) return;

        const isUser = role === 'user';
        const div = document.createElement('div');
        div.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4 animate-fade-in`;
        
        const cleanText = text.split('|||COMMAND|||')[0].trim();
        let htmlContent = cleanText.replace(/\n/g, '<br>');
        
        // Use marked if available for rich text
        if (!isUser && typeof marked !== 'undefined') {
            htmlContent = marked.parse(cleanText);
        }

        div.innerHTML = `
            <span class="text-[9px] font-black text-gray-400 mb-1 px-1 uppercase tracking-tight">${isUser ? 'المستخدم' : 'AutoPilot'}</span>
            <div class="${isUser ? 'bg-primary text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'} p-4 rounded-3xl text-[13px] leading-relaxed max-w-[90%] shadow-sm">
                ${htmlContent}
            </div>
        `;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return div;
    },

    addLoadingIndicator() {
        const messages = document.getElementById('agent-messages');
        const div = document.createElement('div');
        div.className = 'flex gap-1 items-center h-4 p-4';
        div.innerHTML = `<span class="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style="animation-delay:150ms"></span><span class="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style="animation-delay:300ms"></span>`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return div;
    },

    _setupListeners() {
        document.getElementById('agent-clear-btn')?.addEventListener('click', () => Agent.UI.clearChat());
        document.getElementById('agent-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                Agent.UI.sendMessage(); 
            }
        });
    },

    _injectStyles() {
        if (document.getElementById('agent-styles')) return;
        const style = document.createElement('style');
        style.id = 'agent-styles';
        style.textContent = `
            @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            #agent-container { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
            .agent-loading-dot { width: 6px; height: 6px; background: var(--color-primary); border-radius: 50%; opacity: 0.4; }
        `;
        document.head.appendChild(style);
    }
};

/** ⚙️ Commands Module: Handles Tool Execution */
Agent.Commands = {
    async handleResponse(rawText) {
        const parts = rawText.split('|||COMMAND|||');
        if (parts[0].trim()) Agent.UI.addMessage(parts[0].trim(), 'ai');

        for (let i = 1; i < parts.length; i++) {
            try {
                const cmdString = parts[i].trim();
                if (!cmdString) continue;
                const cmd = JSON.parse(cmdString);
                await this.execute(cmd);
            } catch (e) { 
                console.error('Command Parsing/Execution Error:', e, parts[i]); 
            }
        }
    },

    async execute(cmd) {
        if (cmd.type === 'database_action') {
            await this._dbAction(cmd);
        } else if (cmd.type === 'export_excel' || cmd.type === 'export_word') {
            this._fileAction(cmd);
        } else if (cmd.type === 'send_email') {
            if (Agent.sendEmail) await Agent.sendEmail(cmd.to, cmd.subject, cmd.message);
        }
    },

    async _dbAction(cmd) {
        try {
            if (cmd.action === 'insert') await DB.insert(cmd.table, cmd.data);
            else if (cmd.action === 'update') await DB.update(cmd.table, cmd.id, cmd.data);
            else if (cmd.action === 'delete') await DB.delete(cmd.table, cmd.id || cmd.ids?.[0]);
            
            Agent.UI.addMessage(`✅ تم تنفيذ العملية على ${cmd.table} بنجاح.`, 'ai');
            if (window.renderAll) window.renderAll();
            Agent.Brain.getSystemContext(true); // Force refresh context after DB change
        } catch (e) {
            Agent.UI.addMessage(`❌ فشل في قاعدة البيانات: ${e.message}`, 'ai');
        }
    },

    _fileAction(cmd) {
        const messages = document.getElementById('agent-messages');
        const btn = document.createElement('button');
        btn.className = 'w-full bg-primary/10 text-primary p-3 rounded-2xl text-xs font-bold mt-2 flex items-center justify-center gap-2 border border-primary/20 hover:bg-primary hover:text-white transition-all';
        btn.innerHTML = `<span class="material-symbols-outlined text-sm">download</span> تحميل ملف ${cmd.type === 'export_excel' ? 'Excel' : 'Word'}`;
        btn.onclick = () => {
            if (cmd.type === 'export_excel') {
                if (typeof FileUtils !== 'undefined') FileUtils.exportToExcel(cmd.data, cmd.fileName);
            } else {
                if (typeof FileUtils !== 'undefined') FileUtils.exportToWord(cmd.content, cmd.fileName);
            }
        };
        messages.appendChild(btn);
        messages.scrollTop = messages.scrollHeight;
    }
};

// --- GLOBAL ACCESSORS (Backward Compatibility) ---
Agent.sendMessage = () => Agent.UI.sendMessage();
Agent.clearChat = () => Agent.UI.clearChat();
Agent.handleFileUpload = (input) => Agent.UI.handleFileUpload(input);
Agent.toggleChat = () => Agent.UI.toggleChat();
Agent.handleAIResponse = (text) => Agent.Commands.handleResponse(text);

// Initialize on window load
window.Agent = Agent;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Agent.init());
} else {
    Agent.init();
}