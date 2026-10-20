// Self-authored RIASEC interest screener (5 items per type, 1-5 Likert).
// This is a screening tool inspired by Holland's theory, not the O*NET
// Interest Profiler, and is not a validated psychometric instrument.
export type RiasecType = "R" | "I" | "A" | "S" | "E" | "C";

export const RIASEC_QUESTIONS: { id: number; type: RiasecType; text: string; textMs: string }[] = [
  { id: 1, type: "R", text: "Repair or assemble machines and equipment", textMs: "Membaiki atau memasang mesin dan peralatan" },
  { id: 2, type: "I", text: "Analyse data to find out why something happened", textMs: "Menganalisis data untuk mengetahui punca sesuatu berlaku" },
  { id: 3, type: "A", text: "Design posters, videos or visual content", textMs: "Mereka poster, video atau kandungan visual" },
  { id: 4, type: "S", text: "Teach or coach someone to learn a new skill", textMs: "Mengajar atau membimbing seseorang mempelajari kemahiran baharu" },
  { id: 5, type: "E", text: "Convince people to buy a product or support an idea", textMs: "Meyakinkan orang untuk membeli produk atau menyokong idea" },
  { id: 6, type: "C", text: "Keep records, files and spreadsheets organised and accurate", textMs: "Memastikan rekod, fail dan hamparan sentiasa tersusun dan tepat" },
  { id: 7, type: "R", text: "Work outdoors or on a site with tools", textMs: "Bekerja di luar atau di tapak menggunakan alatan" },
  { id: 8, type: "I", text: "Solve complex puzzles or technical problems", textMs: "Menyelesaikan teka-teki atau masalah teknikal yang kompleks" },
  { id: 9, type: "A", text: "Write stories, articles or scripts", textMs: "Menulis cerita, artikel atau skrip" },
  { id: 10, type: "S", text: "Help people who are facing personal difficulties", textMs: "Membantu orang yang menghadapi kesulitan peribadi" },
  { id: 11, type: "E", text: "Lead a team to hit a target", textMs: "Memimpin pasukan untuk mencapai sasaran" },
  { id: 12, type: "C", text: "Follow clear procedures and checklists", textMs: "Mengikut prosedur dan senarai semak yang jelas" },
  { id: 13, type: "R", text: "Install wiring, solar panels or electrical systems", textMs: "Memasang pendawaian, panel solar atau sistem elektrik" },
  { id: 14, type: "I", text: "Read research and test new ideas", textMs: "Membaca kajian dan menguji idea baharu" },
  { id: 15, type: "A", text: "Come up with original concepts for a brand or product", textMs: "Menghasilkan konsep asli untuk jenama atau produk" },
  { id: 16, type: "S", text: "Care for patients, children or the elderly", textMs: "Menjaga pesakit, kanak-kanak atau warga emas" },
  { id: 17, type: "E", text: "Start and run my own business", textMs: "Memulakan dan mengendalikan perniagaan sendiri" },
  { id: 18, type: "C", text: "Check documents and numbers for errors", textMs: "Menyemak dokumen dan angka untuk mencari kesilapan" },
  { id: 19, type: "R", text: "Operate machinery or a production line", textMs: "Mengendalikan jentera atau barisan pengeluaran" },
  { id: 20, type: "I", text: "Write code or build a model to predict outcomes", textMs: "Menulis kod atau membina model untuk meramal hasil" },
  { id: 21, type: "A", text: "Perform, present or express ideas creatively", textMs: "Membuat persembahan atau meluahkan idea secara kreatif" },
  { id: 22, type: "S", text: "Work in a team where people support each other", textMs: "Bekerja dalam pasukan yang saling menyokong" },
  { id: 23, type: "E", text: "Negotiate deals or contracts", textMs: "Merunding urus niaga atau kontrak" },
  { id: 24, type: "C", text: "Manage inventory, invoices or schedules", textMs: "Menguruskan inventori, invois atau jadual" },
  { id: 25, type: "R", text: "Build or fix things with my hands", textMs: "Membina atau membaiki sesuatu dengan tangan sendiri" },
  { id: 26, type: "I", text: "Investigate how systems or the natural world work", textMs: "Menyiasat cara sistem atau alam semula jadi berfungsi" },
  { id: 27, type: "A", text: "Design user interfaces or experiences", textMs: "Mereka antara muka atau pengalaman pengguna" },
  { id: 28, type: "S", text: "Resolve conflicts and listen to others' concerns", textMs: "Menyelesaikan konflik dan mendengar masalah orang lain" },
  { id: 29, type: "E", text: "Pitch ideas to managers or clients", textMs: "Membentangkan idea kepada pengurus atau pelanggan" },
  { id: 30, type: "C", text: "Ensure work complies with rules and standards", textMs: "Memastikan kerja mematuhi peraturan dan piawaian" },
];
