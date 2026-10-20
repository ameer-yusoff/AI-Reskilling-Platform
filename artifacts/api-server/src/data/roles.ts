// Curated Malaysian-relevant role catalogue. SOC codes link each role to the
// Anthropic Economic Index (AI usage and observed exposure). RIASEC codes are
// curated approximations aligned to O*NET interest profiles.
// Skills: [skill name, importance 1-3]
export type RoleSeed = {
  socCode: string;
  title: string;
  titleMs: string;
  sector: string;
  riasecCode: string;
  myColCritical: boolean;
  description: string;
  skills: [string, number][];
};

export const ROLES: RoleSeed[] = [
  {
    socCode: "15-2051", title: "Data Analyst", titleMs: "Penganalisis Data", sector: "Digital & ICT", riasecCode: "ICR", myColCritical: true,
    description: "Turns business data into reports, dashboards and decisions.",
    skills: [["SQL", 3], ["Microsoft Excel", 3], ["Data Visualisation", 3], ["Python", 2], ["Statistics", 2], ["Power BI", 2], ["Stakeholder Communication", 2], ["Generative AI Tools", 1]],
  },
  {
    socCode: "15-2051", title: "Data Scientist", titleMs: "Saintis Data", sector: "Digital & ICT", riasecCode: "ICR", myColCritical: true,
    description: "Builds statistical and machine learning models to predict and optimise outcomes.",
    skills: [["Python", 3], ["Machine Learning", 3], ["Statistics", 3], ["SQL", 3], ["Data Visualisation", 2], ["Cloud Computing", 1], ["Version Control (Git)", 1]],
  },
  {
    socCode: "15-1221", title: "AI / Machine Learning Engineer", titleMs: "Jurutera AI / Pembelajaran Mesin", sector: "Digital & ICT", riasecCode: "IRC", myColCritical: true,
    description: "Designs, deploys and monitors AI models in production systems.",
    skills: [["Python", 3], ["Machine Learning", 3], ["Cloud Computing", 2], ["Version Control (Git)", 2], ["Linux", 2], ["Generative AI Tools", 2], ["Statistics", 2]],
  },
  {
    socCode: "15-1252", title: "Software Developer", titleMs: "Pembangun Perisian", sector: "Digital & ICT", riasecCode: "ICR", myColCritical: true,
    description: "Designs and builds applications and back-end services.",
    skills: [["JavaScript", 3], ["Version Control (Git)", 3], ["SQL", 2], ["Software Testing", 2], ["Cloud Computing", 1], ["Python", 1], ["Problem Solving", 2]],
  },
  {
    socCode: "15-1254", title: "Web Developer", titleMs: "Pembangun Web", sector: "Digital & ICT", riasecCode: "CIR", myColCritical: false,
    description: "Builds and maintains websites and web applications.",
    skills: [["HTML and CSS", 3], ["JavaScript", 3], ["Version Control (Git)", 2], ["UX Design", 1], ["Search Engine Optimisation", 1]],
  },
  {
    socCode: "15-1212", title: "Cybersecurity Analyst", titleMs: "Penganalisis Keselamatan Siber", sector: "Digital & ICT", riasecCode: "CIR", myColCritical: true,
    description: "Monitors, detects and responds to security threats.",
    skills: [["Cybersecurity", 3], ["Networking", 3], ["Linux", 2], ["Cloud Computing", 1], ["Problem Solving", 2], ["Business Writing", 1]],
  },
  {
    socCode: "15-1244", title: "Network and Cloud Administrator", titleMs: "Pentadbir Rangkaian dan Awan", sector: "Digital & ICT", riasecCode: "ICR", myColCritical: false,
    description: "Keeps networks, servers and cloud infrastructure running.",
    skills: [["Networking", 3], ["Cloud Computing", 3], ["Linux", 2], ["Cybersecurity", 2], ["IT Support and Troubleshooting", 2]],
  },
  {
    socCode: "15-1232", title: "IT Support Specialist", titleMs: "Pakar Sokongan IT", sector: "Digital & ICT", riasecCode: "RCI", myColCritical: false,
    description: "Supports users with hardware, software and access issues.",
    skills: [["IT Support and Troubleshooting", 3], ["Networking", 2], ["Customer Service", 2], ["Linux", 1], ["Cloud Computing", 1]],
  },
  {
    socCode: "13-1161", title: "Digital Marketing Specialist", titleMs: "Pakar Pemasaran Digital", sector: "Business Services", riasecCode: "EAC", myColCritical: false,
    description: "Plans and runs paid, organic and social campaigns.",
    skills: [["Digital Marketing", 3], ["Social Media Management", 3], ["Search Engine Optimisation", 2], ["Content Writing", 2], ["Data Visualisation", 1], ["Generative AI Tools", 2]],
  },
  {
    socCode: "27-1024", title: "Graphic Designer", titleMs: "Pereka Grafik", sector: "Creative", riasecCode: "AER", myColCritical: false,
    description: "Creates visual assets for brands, print and digital channels.",
    skills: [["Graphic Design", 3], ["Video Editing", 2], ["UX Design", 1], ["Generative AI Tools", 2], ["Social Media Management", 1]],
  },
  {
    socCode: "15-1255", title: "UX / UI Designer", titleMs: "Pereka UX / UI", sector: "Digital & ICT", riasecCode: "AIE", myColCritical: false,
    description: "Researches users and designs usable digital products.",
    skills: [["UX Design", 3], ["Graphic Design", 2], ["HTML and CSS", 1], ["Stakeholder Communication", 2]],
  },
  {
    socCode: "27-3043", title: "Content Writer", titleMs: "Penulis Kandungan", sector: "Creative", riasecCode: "AIE", myColCritical: false,
    description: "Writes articles, scripts and marketing copy.",
    skills: [["Content Writing", 3], ["Search Engine Optimisation", 2], ["Generative AI Tools", 2], ["Communication (Bahasa Melayu and English)", 3]],
  },
  {
    socCode: "27-3091", title: "Translator and Interpreter", titleMs: "Penterjemah dan Jurubahasa", sector: "Creative", riasecCode: "AIS", myColCritical: false,
    description: "Translates documents and interprets between languages.",
    skills: [["Translation", 3], ["Communication (Bahasa Melayu and English)", 3], ["Mandarin", 2], ["Generative AI Tools", 1]],
  },
  {
    socCode: "13-2011", title: "Accountant", titleMs: "Akauntan", sector: "Finance", riasecCode: "CEI", myColCritical: false,
    description: "Prepares financial statements, audits and tax compliance.",
    skills: [["Financial Accounting", 3], ["Taxation", 2], ["Microsoft Excel", 3], ["ERP Systems", 1], ["Financial Analysis", 2]],
  },
  {
    socCode: "43-3031", title: "Bookkeeping and Accounts Clerk", titleMs: "Kerani Akaun", sector: "Finance", riasecCode: "CRE", myColCritical: false,
    description: "Records transactions and manages invoices and payments.",
    skills: [["Bookkeeping", 3], ["Microsoft Excel", 2], ["Office Administration", 2], ["Taxation", 1]],
  },
  {
    socCode: "13-2051", title: "Financial Analyst", titleMs: "Penganalisis Kewangan", sector: "Finance", riasecCode: "CIE", myColCritical: false,
    description: "Analyses financial performance and builds forecasts.",
    skills: [["Financial Analysis", 3], ["Microsoft Excel", 3], ["Financial Accounting", 2], ["Power BI", 1], ["Stakeholder Communication", 2]],
  },
  {
    socCode: "43-4051", title: "Customer Service Representative", titleMs: "Wakil Khidmat Pelanggan", sector: "Business Services", riasecCode: "CSE", myColCritical: false,
    description: "Handles customer enquiries across voice, chat and email.",
    skills: [["Customer Service", 3], ["Communication (Bahasa Melayu and English)", 3], ["CRM Systems", 2], ["Problem Solving", 2]],
  },
  {
    socCode: "43-6014", title: "Administrative Assistant", titleMs: "Pembantu Tadbir", sector: "Business Services", riasecCode: "CES", myColCritical: false,
    description: "Coordinates office operations, records and scheduling.",
    skills: [["Office Administration", 3], ["Microsoft Excel", 2], ["Business Writing", 2], ["Communication (Bahasa Melayu and English)", 2]],
  },
  {
    socCode: "13-1071", title: "Human Resources Specialist", titleMs: "Pakar Sumber Manusia", sector: "Business Services", riasecCode: "SEC", myColCritical: false,
    description: "Manages recruitment, employee relations and HR compliance.",
    skills: [["Human Resource Management", 3], ["Malaysian Employment Law", 3], ["Microsoft Excel", 1], ["Stakeholder Communication", 2], ["Data Visualisation", 1]],
  },
  {
    socCode: "13-1151", title: "Training and Development Specialist", titleMs: "Pakar Latihan dan Pembangunan", sector: "Education & Training", riasecCode: "SAE", myColCritical: false,
    description: "Designs and delivers workforce training programmes.",
    skills: [["Training Delivery", 3], ["Instructional Design", 3], ["Stakeholder Communication", 2], ["Generative AI Tools", 1]],
  },
  {
    socCode: "13-1082", title: "Project Management Specialist", titleMs: "Pakar Pengurusan Projek", sector: "Business Services", riasecCode: "ECS", myColCritical: false,
    description: "Plans and delivers projects on scope, budget and time.",
    skills: [["Project Management", 3], ["Stakeholder Communication", 3], ["Microsoft Excel", 2], ["Team Leadership", 2], ["Business Writing", 1]],
  },
  {
    socCode: "41-4012", title: "Sales Representative", titleMs: "Wakil Jualan", sector: "Business Services", riasecCode: "ECS", myColCritical: false,
    description: "Builds client relationships and closes sales.",
    skills: [["Sales and Negotiation", 3], ["CRM Systems", 2], ["Communication (Bahasa Melayu and English)", 2], ["Mandarin", 1]],
  },
  {
    socCode: "13-1081", title: "Logistics and Supply Chain Executive", titleMs: "Eksekutif Logistik dan Rantaian Bekalan", sector: "Logistics", riasecCode: "CEI", myColCritical: false,
    description: "Coordinates procurement, inventory and distribution.",
    skills: [["Supply Chain Management", 3], ["Logistics and Warehousing", 3], ["ERP Systems", 2], ["Microsoft Excel", 2], ["Data Visualisation", 1]],
  },
  {
    socCode: "17-2071", title: "Electrical Engineer", titleMs: "Jurutera Elektrik", sector: "Engineering & Manufacturing", riasecCode: "IRC", myColCritical: true,
    description: "Designs and maintains electrical power and control systems.",
    skills: [["Electrical Systems", 3], ["Electronics", 2], ["CAD Drafting", 2], ["PLC and Industrial Automation", 2], ["Project Management", 1]],
  },
  {
    socCode: "17-2199", title: "Mechatronics / Automation Engineer", titleMs: "Jurutera Mekatronik / Automasi", sector: "Engineering & Manufacturing", riasecCode: "RIC", myColCritical: true,
    description: "Integrates mechanical, electronic and software systems for automation.",
    skills: [["PLC and Industrial Automation", 3], ["Electronics", 2], ["IoT and Sensors", 2], ["Mechanical Maintenance", 2], ["Python", 1], ["CAD Drafting", 1]],
  },
  {
    socCode: "17-3023", title: "Electrical and Electronics Technician", titleMs: "Juruteknik Elektrik dan Elektronik", sector: "Engineering & Manufacturing", riasecCode: "RIC", myColCritical: false,
    description: "Installs, tests and repairs electrical and electronic equipment.",
    skills: [["Electrical Systems", 3], ["Electronics", 3], ["Occupational Safety and Health", 2], ["PLC and Industrial Automation", 1]],
  },
  {
    socCode: "49-9041", title: "Industrial Maintenance Technician", titleMs: "Juruteknik Penyelenggaraan Industri", sector: "Engineering & Manufacturing", riasecCode: "RIC", myColCritical: false,
    description: "Maintains and repairs production machinery.",
    skills: [["Mechanical Maintenance", 3], ["Electrical Systems", 2], ["PLC and Industrial Automation", 2], ["Occupational Safety and Health", 2], ["Lean and Six Sigma", 1]],
  },
  {
    socCode: "51-2031", title: "Production Operator", titleMs: "Operator Pengeluaran", sector: "Engineering & Manufacturing", riasecCode: "RCE", myColCritical: false,
    description: "Operates production line equipment and checks output.",
    skills: [["Production Line Operation", 3], ["Quality Control", 2], ["Occupational Safety and Health", 2], ["Lean and Six Sigma", 1]],
  },
  {
    socCode: "51-9061", title: "Quality Control Inspector", titleMs: "Pemeriksa Kawalan Kualiti", sector: "Engineering & Manufacturing", riasecCode: "RCI", myColCritical: false,
    description: "Inspects products and processes against quality standards.",
    skills: [["Quality Control", 3], ["Lean and Six Sigma", 2], ["Statistics", 1], ["Microsoft Excel", 1], ["Business Writing", 1]],
  },
  {
    socCode: "47-2231", title: "Solar PV Installer", titleMs: "Pemasang Solar PV", sector: "Green Economy", riasecCode: "RCI", myColCritical: false,
    description: "Installs and maintains rooftop and ground-mounted solar systems.",
    skills: [["Solar PV Systems", 3], ["Electrical Systems", 3], ["Occupational Safety and Health", 3], ["Energy Management", 1]],
  },
  {
    socCode: "13-1199", title: "Sustainability / ESG Analyst", titleMs: "Penganalisis Kelestarian / ESG", sector: "Green Economy", riasecCode: "ICE", myColCritical: false,
    description: "Measures emissions and prepares sustainability disclosures.",
    skills: [["Sustainability and ESG Reporting", 3], ["Microsoft Excel", 2], ["Data Visualisation", 2], ["Environmental Compliance", 2], ["Business Writing", 2]],
  },
  {
    socCode: "29-1141", title: "Registered Nurse", titleMs: "Jururawat Berdaftar", sector: "Healthcare", riasecCode: "SIC", myColCritical: true,
    description: "Provides and coordinates patient care.",
    skills: [["Patient Care", 3], ["Health Informatics", 1], ["Communication (Bahasa Melayu and English)", 2], ["Team Leadership", 1]],
  },
  {
    socCode: "29-2072", title: "Medical Records and Health Information Specialist", titleMs: "Pakar Rekod Perubatan", sector: "Healthcare", riasecCode: "CIR", myColCritical: false,
    description: "Manages and codes patient health records.",
    skills: [["Health Records and Coding", 3], ["Health Informatics", 2], ["Microsoft Excel", 1], ["Office Administration", 1]],
  },
];
