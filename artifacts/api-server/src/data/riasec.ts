// Self-authored RIASEC interest screener (5 items per type, 1-5 Likert).
// This is a screening tool inspired by Holland's theory, not the O*NET
// Interest Profiler, and is not a validated psychometric instrument.
export type RiasecType = "R" | "I" | "A" | "S" | "E" | "C";

export const RIASEC_QUESTIONS: { id: number; type: RiasecType; text: string; textMs: string; textZh: string }[] = [
  { id: 1, type: "R", text: "Repair or assemble machines and equipment", textMs: "Membaiki atau memasang mesin dan peralatan", textZh: "维修或组装机器和设备" },
  { id: 2, type: "I", text: "Analyse data to find out why something happened", textMs: "Menganalisis data untuk mengetahui punca sesuatu berlaku", textZh: "分析数据，找出事情发生的原因" },
  { id: 3, type: "A", text: "Design posters, videos or visual content", textMs: "Mereka poster, video atau kandungan visual", textZh: "设计海报、视频或视觉内容" },
  { id: 4, type: "S", text: "Teach or coach someone to learn a new skill", textMs: "Mengajar atau membimbing seseorang mempelajari kemahiran baharu", textZh: "教导或指导他人学习新技能" },
  { id: 5, type: "E", text: "Convince people to buy a product or support an idea", textMs: "Meyakinkan orang untuk membeli produk atau menyokong idea", textZh: "说服别人购买产品或支持某个想法" },
  { id: 6, type: "C", text: "Keep records, files and spreadsheets organised and accurate", textMs: "Memastikan rekod, fail dan hamparan sentiasa tersusun dan tepat", textZh: "让记录、文件和电子表格保持整齐准确" },
  { id: 7, type: "R", text: "Work outdoors or on a site with tools", textMs: "Bekerja di luar atau di tapak menggunakan alatan", textZh: "在户外或工地使用工具工作" },
  { id: 8, type: "I", text: "Solve complex puzzles or technical problems", textMs: "Menyelesaikan teka-teki atau masalah teknikal yang kompleks", textZh: "解决复杂的谜题或技术问题" },
  { id: 9, type: "A", text: "Write stories, articles or scripts", textMs: "Menulis cerita, artikel atau skrip", textZh: "撰写故事、文章或剧本" },
  { id: 10, type: "S", text: "Help people who are facing personal difficulties", textMs: "Membantu orang yang menghadapi kesulitan peribadi", textZh: "帮助正面临个人困难的人" },
  { id: 11, type: "E", text: "Lead a team to hit a target", textMs: "Memimpin pasukan untuk mencapai sasaran", textZh: "带领团队达成目标" },
  { id: 12, type: "C", text: "Follow clear procedures and checklists", textMs: "Mengikut prosedur dan senarai semak yang jelas", textZh: "按照清晰的流程和检查清单做事" },
  { id: 13, type: "R", text: "Install wiring, solar panels or electrical systems", textMs: "Memasang pendawaian, panel solar atau sistem elektrik", textZh: "安装电线、太阳能板或电气系统" },
  { id: 14, type: "I", text: "Read research and test new ideas", textMs: "Membaca kajian dan menguji idea baharu", textZh: "阅读研究资料并测试新想法" },
  { id: 15, type: "A", text: "Come up with original concepts for a brand or product", textMs: "Menghasilkan konsep asli untuk jenama atau produk", textZh: "为品牌或产品构思原创概念" },
  { id: 16, type: "S", text: "Care for patients, children or the elderly", textMs: "Menjaga pesakit, kanak-kanak atau warga emas", textZh: "照顾病人、儿童或长者" },
  { id: 17, type: "E", text: "Start and run my own business", textMs: "Memulakan dan mengendalikan perniagaan sendiri", textZh: "创办并经营自己的生意" },
  { id: 18, type: "C", text: "Check documents and numbers for errors", textMs: "Menyemak dokumen dan angka untuk mencari kesilapan", textZh: "检查文件和数字中的错误" },
  { id: 19, type: "R", text: "Operate machinery or a production line", textMs: "Mengendalikan jentera atau barisan pengeluaran", textZh: "操作机械或生产线" },
  { id: 20, type: "I", text: "Write code or build a model to predict outcomes", textMs: "Menulis kod atau membina model untuk meramal hasil", textZh: "编写代码或建立模型来预测结果" },
  { id: 21, type: "A", text: "Perform, present or express ideas creatively", textMs: "Membuat persembahan atau meluahkan idea secara kreatif", textZh: "表演、演讲或以创意方式表达想法" },
  { id: 22, type: "S", text: "Work in a team where people support each other", textMs: "Bekerja dalam pasukan yang saling menyokong", textZh: "在互相支持的团队中工作" },
  { id: 23, type: "E", text: "Negotiate deals or contracts", textMs: "Merunding urus niaga atau kontrak", textZh: "洽谈交易或合同" },
  { id: 24, type: "C", text: "Manage inventory, invoices or schedules", textMs: "Menguruskan inventori, invois atau jadual", textZh: "管理库存、发票或日程" },
  { id: 25, type: "R", text: "Build or fix things with my hands", textMs: "Membina atau membaiki sesuatu dengan tangan sendiri", textZh: "亲手制作或修理东西" },
  { id: 26, type: "I", text: "Investigate how systems or the natural world work", textMs: "Menyiasat cara sistem atau alam semula jadi berfungsi", textZh: "探究系统或自然界如何运作" },
  { id: 27, type: "A", text: "Design user interfaces or experiences", textMs: "Mereka antara muka atau pengalaman pengguna", textZh: "设计用户界面或用户体验" },
  { id: 28, type: "S", text: "Resolve conflicts and listen to others' concerns", textMs: "Menyelesaikan konflik dan mendengar masalah orang lain", textZh: "化解冲突并倾听他人的顾虑" },
  { id: 29, type: "E", text: "Pitch ideas to managers or clients", textMs: "Membentangkan idea kepada pengurus atau pelanggan", textZh: "向经理或客户提出想法" },
  { id: 30, type: "C", text: "Ensure work complies with rules and standards", textMs: "Memastikan kerja mematuhi peraturan dan piawaian", textZh: "确保工作符合规章和标准" },
];
