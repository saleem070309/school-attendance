/**
 * Agent Skills Registry
 * Orchestrates dynamic instruction injection based on active plugins.
 */

const AgentSkills = {
    registry: {
        'skill-reports': {
            name: 'Smart Report Analysis',
            instructions: `
### مهارة تحليل التقارير الذكي:
- أنت الآن تمتلك قدرة تحليلية متقدمة لبيانات الحضور.
- ابحث عن الأنماط: هل هناك أيام معينة يزداد فيها الغياب؟ هل هناك فصول تعاني من تدني الحضور بشكل متكرر؟
- قدم توصيات إدارية (مثلاً: "نلاحظ زيادة غياب طلاب الصف العاشر يوم الخميس، نقترح التواصل مع أولياء أمورهم").
- عند السؤال عن الإحصائيات، لا تكتفِ بالأرقام، بل قدم تحليلاً لما تعنيه هذه الأرقام للمدرسة.`
        },
        'conn-gmail': {
            name: 'Gmail Connector',
            instructions: `
### الربط مع Gmail:
- يمكنك الآن إرسال تقارير عبر البريد الإلكتروني باستخدام أمر send_email.
- اقترح على المستخدم إرسال ملخصات الحضور لمدير المدرسة عبر البريد عند انتهاء التحليل.`
        },
        'skill-performance': {
            name: 'Performance Optimization',
            instructions: `
### مهارة تحسين الأداء (Performance Engineer):
- أنت تعمل حالياً على بيئة ذات موارد محدودة (i3/8GB).
- كن موجزاً في ردودك الطويلة إلا إذا طلب المستخدم التفصيل.
- عند عرض الجداول، اكتفِ بأهم 10-15 صفاً واقترح التصدير للإكسل للبقية.
- استخدم تقنيات التحميل الكسول (Lazy Context) عند التعامل مع البيانات الضخمة.`
        },
        'skill-security': {
            name: 'AegisOps Security Auditor',
            instructions: `
### مهارة التدقيق الأمني (AegisOps AI):
- أنت الآن تلعب دور مدقق أمني للنظام.
- راقب أي محاولات غير مصرح بها أو أنماط دخول مشبوهة في قاعدة البيانات.
- عند تحديث بيانات المعلمين أو الطلاب، تأكد من صحة التنسيقات وعدم وجود ثغرات حقن (SQL/XSS).
- إذا اكتشفت ثغرة، نبه المستخدم فوراً وقدم حلاً تقنياً.`
        },
        'skill-orchestrator': {
            name: 'Agent Orchestrator',
            instructions: `
### مهارة تنسيق المهام (Agent Orchestrator):
- يمكنك الآن إدارة مهام معقدة تتطلب عدة خطوات.
- إذا طلب المستخدم مهمة كبيرة، قسمها إلى مهام فرعية (Sub-tasks) وابلغه بالتقدم في كل مرحلة.
- استخدم "الذاكرة الممتدة" لاسترجاع سياق المهام التي بدأت في جلسات سابقة.`
        }
    },

    async getActiveInstructions() {
        const settings = (await DB.getSettings()) || {};
        const customization = settings.customization || {};
        
        let instructions = '';
        for (const [id, skill] of Object.entries(this.registry)) {
            // Force performance and security for high-tier management
            if (customization[id] || id === 'skill-performance' || id === 'skill-security') {
                instructions += `\n\n${skill.instructions}`;
            }
        }
        return instructions;
    }
};

window.AgentSkills = AgentSkills;
