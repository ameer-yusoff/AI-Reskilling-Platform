// Data Sources documentation strings. URLs, dataset field names, file names and official
// English titles are reference identifiers and are intentionally kept verbatim.
export const docsEn = {
  "docs.ai.retrieval": "CV retrieval is local to one profile: up to 60,000 extracted characters, ranked into at most 18 passages. Up to 5 relevant O*NET skill-reference notes are supplied separately (application reference snapshot content-model-reference-2026-10). These are stable attributed reference notes, not live Malaysian demand. The editable skill glossary and aliases are application-authored; published role requirements come only from the imported O*NET records.",
  "docs.title": "How each source works",
  "docs.sub": "Expand a source for publisher, coverage, method, licence, refresh and limits. Nothing on this site is real-time.",
  "docs.expand": "Show documentation", "docs.collapse": "Hide documentation",
  "docs.type.external": "External dataset", "docs.type.static": "Static method", "docs.type.derived": "Derived by this app", "docs.type.demo": "Demo data", "docs.type.user": "Your own input",
  "docs.typeDesc.external": "Fetched from a named publisher. We show the last successful fetch and its date.",
  "docs.typeDesc.static": "Fixed content written or pinned by this app. It does not change on refresh.",
  "docs.typeDesc.derived": "Calculated by this app from other sources. Accuracy is bounded by those inputs.",
  "docs.typeDesc.demo": "Dummy records for demonstration. Not facts about real people or organisations.",
  "docs.typeDesc.user": "What you type or upload. Private to your account or guest session and never used as market statistics.",
  "docs.f.publisher": "Publisher", "docs.f.dataset": "Dataset page", "docs.f.api": "Endpoint", "docs.f.version": "Version", "docs.f.coverage": "Coverage", "docs.f.fields": "Fields and units",
  "docs.f.method": "How we use it", "docs.f.license": "Licence", "docs.f.cadence": "Refresh", "docs.f.failure": "When a fetch fails", "docs.f.limits": "Limits", "docs.f.privacy": "Privacy", "docs.f.files": "Files",
  "docs.live.title": "Live status", "docs.live.stale": "Stale: showing the last successful data", "docs.live.fresh": "Within the expected refresh window",
  "docs.live.noVersion": "Not reported", "docs.live.unavailable": "Unavailable (not zero)", "docs.live.records": "Records held", "docs.live.dataDate": "Data period", "docs.live.fetched": "Last successful fetch",
  "docs.live.notRealtime": "Not real-time. Figures reflect the latest publisher release we fetched successfully.",
  "docs.live.errorNote": "The last fetch failed. Earlier data is kept where it exists.",
  "docs.tech": "Technical diagnostics (unprocessed, English)", "docs.techNote": "For administrators. This raw message comes from the server or the publisher and is not translated.",

  "docs.dosm.coverage": "Malaysia, monthly Labour Force Survey estimates.",
  "docs.dosm.fields": "u_rate and p_rate in percent (unemployment and labour force participation). lf_employed and lf_unemployed in thousands of persons.",
  "docs.dosm.method": "We request the latest 60 records sorted by date and upsert them by date. Missing months stay missing; we never invent or fill values.",
  "docs.dosm.license": "CC BY 4.0 under the data.gov.my terms of use.",
  "docs.dosm.cadence": "Publisher releases monthly. This app checks every 6 hours.",
  "docs.dosm.failure": "On failure we keep the last successful data and show its date.",

  "docs.aeiu.version": "The live release folder detected for this source (see live status).",
  "docs.aeiu.files": "Latest compatible release_YYYY_MM_DD/data/aei_claude_ai_YYYY-MM-DD.csv, discovered automatically through the Hugging Face tree API.",
  "docs.aeiu.method": "Usage percent by SOC occupation for MYS and GLOBAL. SOC codes are normalised by removing the decimal suffix.",
  "docs.aeiu.limits": "A share of Claude conversations only. It is not all AI use, not all users, and not job vacancies.",
  "docs.aeiu.license": "MIT, as declared by the publisher's dataset card and metadata API (checked 21 October 2026). Preserve the copyright and licence notice when redistributing; recheck on a licence or release change.",
  "docs.aeiu.cadence": "Publisher releases irregularly. This app checks every 6 hours.",

  "docs.aeie.fields": "Exposure from 0 to 1: the observed share of an occupation's tasks seen in AI usage. Keyed by US SOC as a reference.",
  "docs.aeie.limits": "Not a probability of job loss. Each fetch resolves a publisher revision and reads that pinned commit; the revision is shown in the live version. No publication period is asserted where none is supplied.",

  "docs.onet.version": "31.0 (August 2026), pinned. Moving to a new version needs a reviewed upgrade.",
  "docs.onet.coverage": "United States occupations only.",
  "docs.onet.method": "Each app role has an explicit six-digit SOC that must match an O*NET .00 occupation exactly. There is no MASCO or MyCOL equivalence. Unmatched roles show as unavailable, with no seed fallback.",
  "docs.onet.skills": "Skills: non-suppressed ratings with importance (IM) of 3 or more, top 12 per role. Importance 1-5 is mapped to 1-3 with round(1 + (IM - 1) / 2).",
  "docs.onet.riasec": "Role RIASEC code: the top three official interest (OI) scores on the 1-7 scale. Matched records only.",
  "docs.onet.provenance": "Every role stores its fetched timestamp, sourceUrl, sourceVersion and officialTitle. The official English title is a reference name.",
  "docs.onet.license": "CC BY 4.0 with attribution. This app's changes (selection and rescaling above) are disclosed here.",
  "docs.onet.cadence": "Publisher updates quarterly. This app checks every 6 hours, but the version stays pinned.",

  "docs.course.status": "No verified feed of provider prices, durations or HRD Corp claim status is configured. The seed catalogue is withheld from public pages and from the pathway planner.",
  "docs.course.limits": "A reachable link does not prove the content, price, HRD Corp status or licence. A missing price never means free.",
  "docs.course.license": "No market feed licence is asserted.",

  "docs.ai.checks": "Status checks read model metadata and health only. They do not generate text, so a healthy status does not prove a reply will succeed.",
  "docs.ai.cold": "A health check may wake a sleeping server. We make no claim that idle time is free of GPU cost.",
  "docs.ai.ids": "Endpoint IDs are not public secrets. API keys are never shown.",
  "docs.ai.configured": "Provider, model and health come from the live AI status. If the API key is missing, the service shows as not configured.",
  "docs.ai.privacy": "With your consent, text extracted from your CV is sent to RunPod. The original file is discarded. Extracted text and evidence are retained with your profile; guest profiles are kept for 7 days.",

  "docs.riasec.items": "30 statements written by this app and translated into three languages. They are not the validated, licensed O*NET Interest Profiler. Answers use a 1-5 scale.",
  "docs.riasec.scoring": "The API needs at least 18 unique answers and at least 3 per dimension; the onboarding wizard asks for all 30. Each dimension is the mean answer, rounded to 2 decimals. Ties break in the fixed order R, I, A, S, E, C.",
  "docs.riasec.limits": "Not a diagnosis. Never inferred from your CV.",

  "docs.match.weights": "Weights: skills 40, transferable 15, interest 20, preferences 10, feasibility 15.",
  "docs.match.demand": "Labour demand is not fabricated. Until a verified Malaysian demand source exists it is null and shown as not verified, not zero.",
  "docs.match.feasibility": "When no verified course exists, feasibility is unavailable and gets zero credit. It is not estimated from course durations.",

  "docs.sdg.method": "Static thematic links between sectors and UN Sustainable Development Goals.",
  "docs.sdg.limits": "Not measured or certified impact, and not SDG statistics.",

  "docs.demo.org": "Employee and Educators demo accounts are tagged as dummy. Their organisations and members are not external facts.",
  "docs.demo.individual": "Dummy individual sign-ups use a unique @example.invalid address. No email is ever sent.",
  "docs.demo.private": "Real inputs from signed-in users and guests are private and are never counted as market statistics.",

  "docs.name.riasec": "Interest questionnaire (RIASEC)", "docs.name.match": "Role match score", "docs.name.sdg": "SDG associations", "docs.name.demo": "Demo and personal data",
  "src.onet.name": "O*NET occupation references", "src.onet.desc": "Official US occupation, skill and interest reference data, linked through an explicit SOC crosswalk. Not Malaysian vacancies.",
} as const;

export type DocsKey = keyof typeof docsEn;

export const docsMs: Record<DocsKey, string> = {
  "docs.ai.retrieval": "Retrieval CV terasing kepada satu profil: sehingga 60,000 aksara diekstrak dan diperingkat kepada maksimum 18 petikan. Sehingga 5 nota rujukan kemahiran O*NET yang relevan diberi berasingan (snapshot rujukan aplikasi content-model-reference-2026-10). Ini rujukan stabil beratribusi, bukan permintaan Malaysia semasa. Glosari kemahiran dan alias boleh sunting dikarang aplikasi; keperluan peranan yang diterbitkan datang hanya daripada rekod O*NET yang diimport.",
  "docs.title": "Cara setiap sumber berfungsi",
  "docs.sub": "Kembangkan sumber untuk penerbit, liputan, kaedah, lesen, kekerapan kemas kini dan had. Tiada apa-apa di laman ini masa nyata.",
  "docs.expand": "Tunjuk dokumentasi", "docs.collapse": "Sembunyi dokumentasi",
  "docs.type.external": "Set data luaran", "docs.type.static": "Kaedah statik", "docs.type.derived": "Diterbitkan oleh aplikasi ini", "docs.type.demo": "Data demo", "docs.type.user": "Input anda sendiri",
  "docs.typeDesc.external": "Diambil daripada penerbit yang dinamakan. Kami tunjukkan pengambilan berjaya terakhir dan tarikhnya.",
  "docs.typeDesc.static": "Kandungan tetap yang ditulis atau dikunci oleh aplikasi ini. Ia tidak berubah apabila dimuat semula.",
  "docs.typeDesc.derived": "Dikira oleh aplikasi ini daripada sumber lain. Ketepatannya terhad oleh input tersebut.",
  "docs.typeDesc.demo": "Rekod contoh untuk demonstrasi. Bukan fakta tentang individu atau organisasi sebenar.",
  "docs.typeDesc.user": "Apa yang anda taip atau muat naik. Peribadi kepada akaun atau sesi tetamu anda dan tidak digunakan sebagai statistik pasaran.",
  "docs.f.publisher": "Penerbit", "docs.f.dataset": "Halaman set data", "docs.f.api": "Titik akhir", "docs.f.version": "Versi", "docs.f.coverage": "Liputan", "docs.f.fields": "Medan dan unit",
  "docs.f.method": "Cara kami menggunakannya", "docs.f.license": "Lesen", "docs.f.cadence": "Kemas kini", "docs.f.failure": "Jika pengambilan gagal", "docs.f.limits": "Had", "docs.f.privacy": "Privasi", "docs.f.files": "Fail",
  "docs.live.title": "Status langsung", "docs.live.stale": "Lapuk: menunjukkan data berjaya terakhir", "docs.live.fresh": "Dalam tempoh kemas kini yang dijangka",
  "docs.live.noVersion": "Tidak dilaporkan", "docs.live.unavailable": "Tidak tersedia (bukan sifar)", "docs.live.records": "Rekod disimpan", "docs.live.dataDate": "Tempoh data", "docs.live.fetched": "Pengambilan berjaya terakhir",
  "docs.live.notRealtime": "Bukan masa nyata. Angka mencerminkan keluaran terkini penerbit yang berjaya kami ambil.",
  "docs.live.errorNote": "Pengambilan terakhir gagal. Data terdahulu dikekalkan jika ada.",
  "docs.tech": "Diagnostik teknikal (mentah, bahasa Inggeris)", "docs.techNote": "Untuk pentadbir. Mesej mentah ini datang daripada pelayan atau penerbit dan tidak diterjemah.",

  "docs.dosm.coverage": "Malaysia, anggaran Survei Tenaga Buruh bulanan.",
  "docs.dosm.fields": "u_rate dan p_rate dalam peratus (pengangguran dan penyertaan tenaga buruh). lf_employed dan lf_unemployed dalam ribu orang.",
  "docs.dosm.method": "Kami meminta 60 rekod terkini mengikut tarikh dan menyimpannya (upsert) mengikut tarikh. Bulan yang tiada kekal tiada; kami tidak mereka atau mengisi nilai.",
  "docs.dosm.license": "CC BY 4.0 di bawah terma penggunaan data.gov.my.",
  "docs.dosm.cadence": "Penerbit mengeluarkan data bulanan. Aplikasi ini menyemak setiap 6 jam.",
  "docs.dosm.failure": "Jika gagal, kami kekalkan data berjaya terakhir dan tunjukkan tarikhnya.",

  "docs.aeiu.version": "Folder keluaran langsung yang dikesan untuk sumber ini (lihat status langsung).",
  "docs.aeiu.files": "release_YYYY_MM_DD/data/aei_claude_ai_YYYY-MM-DD.csv serasi terkini, dikesan secara automatik melalui API pepohon Hugging Face.",
  "docs.aeiu.method": "Peratus penggunaan mengikut pekerjaan SOC untuk MYS dan GLOBAL. Kod SOC dinormalkan dengan membuang akhiran perpuluhan.",
  "docs.aeiu.limits": "Hanya bahagian perbualan Claude. Ia bukan semua penggunaan AI, bukan semua pengguna, dan bukan kekosongan jawatan.",
  "docs.aeiu.license": "MIT menurut kad set data dan API metadata penerbit (disemak 21 Oktober 2026). Kekalkan notis hak cipta dan lesen semasa pengedaran semula; semak semula apabila lesen atau keluaran berubah.",
  "docs.aeiu.cadence": "Penerbit mengeluarkan secara tidak tetap. Aplikasi ini menyemak setiap 6 jam.",

  "docs.aeie.fields": "Pendedahan dari 0 hingga 1: bahagian tugas pekerjaan yang diperhatikan dalam penggunaan AI. Dikunci mengikut SOC AS sebagai rujukan.",
  "docs.aeie.limits": "Bukan kebarangkalian kehilangan kerja. Setiap pengambilan mendapatkan revisi penerbit dan membaca commit terkunci tersebut; revisi dipaparkan dalam versi sumber. Tempoh penerbitan tidak didakwa jika tidak diberikan.",

  "docs.onet.version": "31.0 (Ogos 2026), dikunci. Bertukar ke versi baharu memerlukan naik taraf yang disemak.",
  "docs.onet.coverage": "Pekerjaan Amerika Syarikat sahaja.",
  "docs.onet.method": "Setiap peranan aplikasi mempunyai SOC enam digit yang jelas dan mesti sepadan tepat dengan pekerjaan O*NET .00. Tiada kesetaraan MASCO atau MyCOL. Peranan yang tidak sepadan ditunjukkan sebagai tidak tersedia, tanpa sandaran data benih.",
  "docs.onet.skills": "Kemahiran: penilaian tidak disekat dengan kepentingan (IM) 3 atau lebih, 12 teratas setiap peranan. Kepentingan 1-5 dipetakan ke 1-3 dengan round(1 + (IM - 1) / 2).",
  "docs.onet.riasec": "Kod RIASEC peranan: tiga skor minat (OI) rasmi tertinggi pada skala 1-7. Rekod yang sepadan sahaja.",
  "docs.onet.provenance": "Setiap peranan menyimpan cap masa pengambilan, sourceUrl, sourceVersion dan officialTitle. Tajuk rasmi bahasa Inggeris ialah nama rujukan.",
  "docs.onet.license": "CC BY 4.0 dengan atribusi. Perubahan aplikasi ini (pemilihan dan penskalaan semula di atas) didedahkan di sini.",
  "docs.onet.cadence": "Penerbit mengemas kini setiap suku tahun. Aplikasi ini menyemak setiap 6 jam, tetapi versi kekal dikunci.",

  "docs.course.status": "Tiada suapan disahkan bagi harga, tempoh atau status tuntutan HRD Corp penyedia dikonfigurasi. Katalog benih ditahan daripada halaman awam dan perancang laluan.",
  "docs.course.limits": "Pautan yang boleh dicapai tidak membuktikan kandungan, harga, status HRD Corp atau lesen. Harga yang tiada tidak bermakna percuma.",
  "docs.course.license": "Tiada lesen suapan pasaran didakwa.",

  "docs.ai.checks": "Semakan status hanya membaca metadata dan kesihatan model. Ia tidak menjana teks, jadi status sihat tidak membuktikan jawapan akan berjaya.",
  "docs.ai.cold": "Semakan kesihatan mungkin membangunkan pelayan yang tidur. Kami tidak mendakwa masa terbiar bebas kos GPU.",
  "docs.ai.ids": "ID titik akhir bukan rahsia awam. Kunci API tidak pernah ditunjukkan.",
  "docs.ai.configured": "Penyedia, model dan kesihatan datang daripada status AI langsung. Jika kunci API tiada, perkhidmatan ditunjukkan sebagai belum dikonfigurasi.",
  "docs.ai.privacy": "Dengan persetujuan anda, teks yang diekstrak daripada CV dihantar ke RunPod. Fail asal dibuang. Teks dan bukti yang diekstrak disimpan bersama profil anda; profil tetamu disimpan selama 7 hari.",

  "docs.riasec.items": "30 kenyataan yang ditulis oleh aplikasi ini dan diterjemah ke tiga bahasa. Ia bukan O*NET Interest Profiler yang disahkan dan berlesen. Jawapan menggunakan skala 1-5.",
  "docs.riasec.scoring": "API memerlukan sekurang-kurangnya 18 jawapan unik dan sekurang-kurangnya 3 bagi setiap dimensi; wizard onboarding meminta kesemua 30. Setiap dimensi ialah purata jawapan, dibundarkan kepada 2 perpuluhan. Seri diputuskan mengikut susunan tetap R, I, A, S, E, C.",
  "docs.riasec.limits": "Bukan diagnosis. Tidak pernah disimpulkan daripada CV anda.",

  "docs.match.weights": "Pemberat: kemahiran 40, boleh pindah 15, minat 20, keutamaan 10, kebolehlaksanaan 15.",
  "docs.match.demand": "Permintaan buruh tidak direka. Sehingga sumber permintaan Malaysia yang disahkan wujud, ia null dan ditunjukkan sebagai belum disahkan, bukan sifar.",
  "docs.match.feasibility": "Jika tiada kursus disahkan, kebolehlaksanaan tidak tersedia dan diberi kredit sifar. Ia tidak dianggarkan daripada tempoh kursus.",

  "docs.sdg.method": "Pautan tematik statik antara sektor dan Matlamat Pembangunan Mampan PBB.",
  "docs.sdg.limits": "Bukan impak yang diukur atau diperakui, dan bukan statistik SDG.",

  "docs.demo.org": "Akaun demo Employee dan Educators ditandakan sebagai contoh. Organisasi dan ahlinya bukan fakta luaran.",
  "docs.demo.individual": "Pendaftaran individu contoh menggunakan alamat @example.invalid yang unik. Tiada e-mel pernah dihantar.",
  "docs.demo.private": "Input sebenar pengguna log masuk dan tetamu adalah peribadi dan tidak pernah dikira sebagai statistik pasaran.",

  "docs.name.riasec": "Soal selidik minat (RIASEC)", "docs.name.match": "Skor padanan peranan", "docs.name.sdg": "Kaitan SDG", "docs.name.demo": "Data demo dan peribadi",
  "src.onet.name": "Rujukan pekerjaan O*NET", "src.onet.desc": "Data rujukan rasmi AS bagi pekerjaan, kemahiran dan minat, dipautkan melalui padanan SOC yang jelas. Bukan kekosongan jawatan di Malaysia.",
};

export const docsZh: Record<DocsKey, string> = {
  "docs.ai.retrieval": "简历检索仅限单个档案：最多提取 60,000 个字符，按相关性选出最多 18 段。另提供最多 5 条相关的 O*NET 技能参考笔记（应用参考快照 content-model-reference-2026-10）。这些是注明出处的稳定参考，并非马来西亚实时需求。可编辑技能词汇和别名由应用编写；公开职位要求仅来自导入的 O*NET 记录。",
  "docs.title": "各数据来源的说明",
  "docs.sub": "展开来源可查看发布方、覆盖范围、方法、许可、更新频率与限制。本网站内容均非实时。",
  "docs.expand": "显示说明", "docs.collapse": "隐藏说明",
  "docs.type.external": "外部数据集", "docs.type.static": "静态方法", "docs.type.derived": "本应用推导", "docs.type.demo": "演示数据", "docs.type.user": "你自己的输入",
  "docs.typeDesc.external": "从指定发布方获取。我们显示最近一次成功获取及其日期。",
  "docs.typeDesc.static": "由本应用编写或固定的内容，刷新时不会改变。",
  "docs.typeDesc.derived": "由本应用根据其他来源计算，准确度受这些输入限制。",
  "docs.typeDesc.demo": "用于演示的虚构记录，并非关于真实个人或机构的事实。",
  "docs.typeDesc.user": "你输入或上传的内容。仅属于你的账户或访客会话，绝不作为市场统计使用。",
  "docs.f.publisher": "发布方", "docs.f.dataset": "数据集页面", "docs.f.api": "接口", "docs.f.version": "版本", "docs.f.coverage": "覆盖范围", "docs.f.fields": "字段与单位",
  "docs.f.method": "我们的使用方式", "docs.f.license": "许可", "docs.f.cadence": "更新", "docs.f.failure": "获取失败时", "docs.f.limits": "限制", "docs.f.privacy": "隐私", "docs.f.files": "文件",
  "docs.live.title": "实时状态", "docs.live.stale": "已过时：显示最近一次成功的数据", "docs.live.fresh": "在预期更新周期内",
  "docs.live.noVersion": "未报告", "docs.live.unavailable": "不可用（并非为零）", "docs.live.records": "已保存记录", "docs.live.dataDate": "数据期间", "docs.live.fetched": "最近一次成功获取",
  "docs.live.notRealtime": "非实时。数字反映我们最近一次成功获取的发布方数据。",
  "docs.live.errorNote": "最近一次获取失败。如有旧数据则予以保留。",
  "docs.tech": "技术诊断（原始英文信息）", "docs.techNote": "供管理员参考。此原始信息来自服务器或发布方，未经翻译。",

  "docs.dosm.coverage": "马来西亚，每月劳动力调查估计。",
  "docs.dosm.fields": "u_rate 与 p_rate 以百分比表示（失业率与劳动力参与率）。lf_employed 与 lf_unemployed 以千人为单位。",
  "docs.dosm.method": "我们按日期请求最新 60 条记录，并按日期写入（upsert）。缺失月份保持缺失，我们从不编造或填补数值。",
  "docs.dosm.license": "依据 data.gov.my 使用条款，采用 CC BY 4.0。",
  "docs.dosm.cadence": "发布方每月发布。本应用每 6 小时检查一次。",
  "docs.dosm.failure": "失败时保留最近一次成功的数据并显示其日期。",

  "docs.aeiu.version": "本来源检测到的实时发布文件夹（见实时状态）。",
  "docs.aeiu.files": "最新兼容的 release_YYYY_MM_DD/data/aei_claude_ai_YYYY-MM-DD.csv，通过 Hugging Face 目录树 API 自动发现。",
  "docs.aeiu.method": "按 SOC 职业划分的 MYS 与 GLOBAL 使用百分比。SOC 代码会去除小数后缀进行规范化。",
  "docs.aeiu.limits": "仅为 Claude 对话所占比例，不代表全部 AI 使用、全部用户或职位空缺。",
  "docs.aeiu.license": "发布者的数据集卡片和元数据 API 声明为 MIT 许可（2026 年 10 月 21 日核实）。再分发时保留版权和许可声明；许可或版本变更时重新核实。",
  "docs.aeiu.cadence": "发布方不定期发布。本应用每 6 小时检查一次。",

  "docs.aeie.fields": "影响度 0 到 1：在 AI 使用中观察到的职业任务比例。以美国 SOC 作为参考键。",
  "docs.aeie.limits": "并非失业概率。每次获取先确定发布者的修订版本，再读取该固定提交；修订号显示在来源版本中。未提供发布周期时不作推断。",

  "docs.onet.version": "31.0（2026 年 8 月），已固定。升级到新版本需要经过审核。",
  "docs.onet.coverage": "仅限美国职业。",
  "docs.onet.method": "每个应用职位都有明确的六位 SOC，必须与 O*NET .00 职业完全匹配。不存在与 MASCO 或 MyCOL 的对等关系。未匹配的职位显示为不可用，不使用种子数据替代。",
  "docs.onet.skills": "技能：选取未被抑制、重要度（IM）不低于 3 的评分，每个职位前 12 项。重要度 1-5 按 round(1 + (IM - 1) / 2) 映射为 1-3。",
  "docs.onet.riasec": "职位 RIASEC 代码：官方兴趣（OI）1-7 分中最高的三项。仅限已匹配记录。",
  "docs.onet.provenance": "每个职位都保存获取时间戳、sourceUrl、sourceVersion 与 officialTitle。英文官方职称是参考名称。",
  "docs.onet.license": "CC BY 4.0，需署名。本应用的改动（上述筛选与重新标度）在此披露。",
  "docs.onet.cadence": "发布方每季度更新。本应用每 6 小时检查一次，但版本保持固定。",

  "docs.course.status": "尚未配置经核实的机构价格、时长或 HRD Corp 申领状态数据源。种子课程目录不在公开页面和路径规划中显示。",
  "docs.course.limits": "链接可访问并不能证明内容、价格、HRD Corp 状态或许可。缺少价格绝不代表免费。",
  "docs.course.license": "不声称任何市场数据源许可。",

  "docs.ai.checks": "状态检查只读取模型元数据和健康状况，不生成文本，因此状态正常并不保证回复一定成功。",
  "docs.ai.cold": "健康检查可能唤醒休眠的服务器。我们不声称空闲时不产生 GPU 费用。",
  "docs.ai.ids": "接口 ID 不是公开机密。API 密钥从不显示。",
  "docs.ai.configured": "服务商、模型与健康状况来自实时 AI 状态。若缺少 API 密钥，服务会显示为未配置。",
  "docs.ai.privacy": "经你同意，从简历提取的文字会发送至 RunPod。原始文件会被丢弃。提取的文字与依据随档案保存；访客档案保留 7 天。",

  "docs.riasec.items": "由本应用编写并译成三种语言的 30 个陈述。它不是经过验证并获授权的 O*NET Interest Profiler。答案采用 1-5 分。",
  "docs.riasec.scoring": "API 需要至少 18 个不重复答案，且每个维度至少 3 个；引导流程要求回答全部 30 题。每个维度取答案平均值，保留 2 位小数。平分时按固定顺序 R、I、A、S、E、C 决定。",
  "docs.riasec.limits": "并非诊断，也绝不从简历推断。",

  "docs.match.weights": "权重：技能 40、可迁移 15、兴趣 20、偏好 10、可行性 15。",
  "docs.match.demand": "劳动力需求不会被编造。在有经核实的马来西亚需求来源之前，该值为空，并显示为未核实，而非为零。",
  "docs.match.feasibility": "没有经核实的课程时，可行性不可用，得分为零。不会根据课程时长估算。",

  "docs.sdg.method": "行业与联合国可持续发展目标之间的静态主题关联。",
  "docs.sdg.limits": "并非经测量或认证的影响，也不是 SDG 统计数据。",

  "docs.demo.org": "Employee 与 Educators 演示账户已标注为示例。其机构与成员并非外部事实。",
  "docs.demo.individual": "示例个人注册使用唯一的 @example.invalid 地址，不会发送任何邮件。",
  "docs.demo.private": "已登录用户与访客的真实输入均为私密，绝不计入市场统计。",

  "docs.name.riasec": "兴趣问卷（RIASEC）", "docs.name.match": "职位匹配分数", "docs.name.sdg": "SDG 关联", "docs.name.demo": "演示与个人数据",
  "src.onet.name": "O*NET 职业参考", "src.onet.desc": "美国官方职业、技能与兴趣参考数据，通过明确的 SOC 对照表关联。并非马来西亚职位空缺。",
};
