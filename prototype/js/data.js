// Sample data for the prototype. Every name, phone number, price and date here is
// invented. Web addresses use the reserved .example domain so nothing points at a real site.
// Map positions are on a 1000 by 640 illustrative grid, roughly 0.03 km per unit.

export const KM_PER_UNIT = 0.03;

export const YOU = { x: 478, y: 262, area: 'Begumpet', address: 'Near Prakash Nagar Metro, Begumpet' };

export const AREAS = [
  { name: 'Kukatpally', x: 300, y: 130 },
  { name: 'Kondapur', x: 165, y: 235 },
  { name: 'Madhapur', x: 225, y: 318 },
  { name: 'Gachibowli', x: 120, y: 410 },
  { name: 'Jubilee Hills', x: 318, y: 372 },
  { name: 'Banjara Hills', x: 398, y: 392 },
  { name: 'Ameerpet', x: 410, y: 280 },
  { name: 'Begumpet', x: 492, y: 228 },
  { name: 'Secunderabad', x: 632, y: 180 },
  { name: 'Somajiguda', x: 470, y: 352 },
  { name: 'Himayatnagar', x: 592, y: 392 },
  { name: 'Tolichowki', x: 288, y: 468 },
  { name: 'Charminar', x: 615, y: 528 },
  { name: 'Dilsukhnagar', x: 772, y: 470 },
  { name: 'Uppal', x: 850, y: 290 },
];

export const AREA_NAMES = AREAS.map((a) => a.name).sort();

export function distanceKm(a, b = YOU) {
  return Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_UNIT;
}

export const PLATFORMS = ['Apollo Pharmacy', 'MedPlus', 'Tata 1mg'];

export const HOSPITALS = [
  {
    id: 'h1', name: 'Lakeview Multispeciality Hospital', area: 'Begumpet', x: 470, y: 238,
    address: '14 Airport Road, Begumpet, Hyderabad 500016',
    description: 'A 300 bed multispeciality hospital with a 24 hour emergency department, cardiac care and a neurology unit.',
    phone: '+91 40 4000 1201', email: 'care@lakeview.example', website: 'https://lakeview.example',
    emergency: true, rating: 4.5, reviews: 812,
    specialities: ['Cardiology', 'Neurology', 'Orthopaedics', 'General Medicine', 'Emergency Medicine'],
    departments: ['Emergency', 'Intensive care', 'Cardiology', 'Neurology', 'Radiology', 'Pharmacy'],
    source: 'Apollo 24|7', checked: '22 Oct 2026',
  },
  {
    id: 'h2', name: 'Deccan Heart and Lung Institute', area: 'Somajiguda', x: 482, y: 346,
    address: '6-3-1090 Raj Bhavan Road, Somajiguda, Hyderabad 500082',
    description: 'A specialist centre for heart and lung care, with a cardiac catheterisation lab and a pulmonary function lab.',
    phone: '+91 40 4000 1302', email: 'contact@deccanheart.example', website: 'https://deccanheart.example',
    emergency: true, rating: 4.6, reviews: 530,
    specialities: ['Cardiology', 'Pulmonology', 'Cardiothoracic Surgery'],
    departments: ['Emergency', 'Cardiac intensive care', 'Cath lab', 'Pulmonary function lab'],
    source: 'Apollo 24|7', checked: '21 Oct 2026',
  },
  {
    id: 'h3', name: 'Sanjeevani General Hospital', area: 'Secunderabad', x: 618, y: 192,
    address: '22 Sardar Patel Road, Secunderabad 500003',
    description: 'A general hospital serving Secunderabad, with maternity, paediatric and general surgery services.',
    phone: '+91 40 4000 1403', email: 'help@sanjeevani.example', website: 'https://sanjeevani.example',
    emergency: true, rating: 4.2, reviews: 1204,
    specialities: ['General Medicine', 'General Surgery', 'Paediatrics', 'Obstetrics and Gynaecology'],
    departments: ['Emergency', 'Maternity', 'Paediatrics', 'Operation theatres', 'Laboratory'],
    source: 'Tata 1mg', checked: '19 Oct 2026',
  },
  {
    id: 'h4', name: 'Hitec City Medical Centre', area: 'Madhapur', x: 236, y: 310,
    address: 'Plot 9, Hitec City Main Road, Madhapur, Hyderabad 500081',
    description: 'A tertiary care hospital with orthopaedics, digestive diseases and kidney care.',
    phone: '+91 40 4000 1504', email: 'info@hitecmedical.example', website: 'https://hitecmedical.example',
    emergency: true, rating: 4.4, reviews: 690,
    specialities: ['Orthopaedics', 'Gastroenterology', 'Nephrology', 'Urology'],
    departments: ['Emergency', 'Dialysis', 'Endoscopy', 'Radiology'],
    source: 'Apollo 24|7', checked: '23 Oct 2026',
  },
  {
    id: 'h5', name: 'Little Steps Children’s Hospital', area: 'Kondapur', x: 176, y: 246,
    address: '3 Botanical Garden Road, Kondapur, Hyderabad 500084',
    description: 'A children’s hospital with a paediatric emergency room and a newborn intensive care unit.',
    phone: '+91 40 4000 1605', email: 'parents@littlesteps.example', website: 'https://littlesteps.example',
    emergency: true, rating: 4.7, reviews: 402,
    specialities: ['Paediatrics', 'Neonatology'],
    departments: ['Paediatric emergency', 'Newborn intensive care', 'Vaccination'],
    source: 'Tata 1mg', checked: '18 Oct 2026',
  },
  {
    id: 'h6', name: 'Golconda Spine and Joint Centre', area: 'Tolichowki', x: 300, y: 474,
    address: '11 Seven Tombs Road, Tolichowki, Hyderabad 500008',
    description: 'A specialist centre for joint replacement, spine surgery and physiotherapy. No emergency department.',
    phone: '+91 40 4000 1706', email: 'desk@golcondaspine.example', website: 'https://golcondaspine.example',
    emergency: false, rating: 4.3, reviews: 288,
    specialities: ['Orthopaedics', 'Spine Surgery', 'Physiotherapy'],
    departments: ['Outpatients', 'Operation theatres', 'Physiotherapy'],
    source: 'Apollo 24|7', checked: '12 Sep 2026',
  },
  {
    id: 'h7', name: 'Clearsight Eye Hospital', area: 'Himayatnagar', x: 588, y: 386,
    address: '3-6-150 Himayatnagar Main Road, Hyderabad 500029',
    description: 'An eye hospital offering cataract, retina and cornea care.',
    phone: '+91 40 4000 1807', email: 'eyes@clearsight.example', website: 'https://clearsight.example',
    emergency: false, rating: 4.5, reviews: 356,
    specialities: ['Ophthalmology'],
    departments: ['Outpatients', 'Cataract surgery', 'Retina clinic'],
    source: 'Tata 1mg', checked: '20 Oct 2026',
  },
  {
    id: 'h8', name: 'Eastside Community Hospital', area: 'Dilsukhnagar', x: 760, y: 472,
    address: '16-11 Main Road, Dilsukhnagar, Hyderabad 500060',
    description: 'A community hospital with general medicine, skin care and ear, nose and throat services.',
    phone: '+91 40 4000 1908', email: 'reception@eastside.example', website: 'https://eastside.example',
    emergency: true, rating: 4.0, reviews: 517,
    specialities: ['General Medicine', 'Dermatology', 'ENT', 'General Surgery'],
    departments: ['Emergency', 'Outpatients', 'Laboratory', 'Pharmacy'],
    source: 'Apollo 24|7', checked: '17 Oct 2026',
  },
];

export const DOCTORS = [
  { id: 'd1', name: 'Dr. Ananya Rao', specialization: 'Cardiology', qualifications: ['MBBS', 'MD (General Medicine)', 'DM (Cardiology)'], experience: 14, hospitalId: 'h2', timings: 'Monday to Saturday, 10:00 to 14:00', rating: 4.8, reviews: 214, source: 'Apollo 24|7', checked: '21 Oct 2026' },
  { id: 'd2', name: 'Dr. Vikram Reddy', specialization: 'Orthopaedics', qualifications: ['MBBS', 'MS (Orthopaedics)'], experience: 18, hospitalId: 'h4', timings: 'Monday to Friday, 09:00 to 13:00', rating: 4.6, reviews: 341, source: 'Apollo 24|7', checked: '23 Oct 2026' },
  { id: 'd3', name: 'Dr. Farah Siddiqui', specialization: 'Dermatology', qualifications: ['MBBS', 'MD (Dermatology)'], experience: 9, hospitalId: 'h8', timings: 'Tuesday, Thursday and Saturday, 16:00 to 19:00', rating: 4.7, reviews: 158, source: 'Tata 1mg', checked: '17 Oct 2026' },
  { id: 'd4', name: 'Dr. Karthik Iyer', specialization: 'Neurology', qualifications: ['MBBS', 'MD (General Medicine)', 'DM (Neurology)'], experience: 12, hospitalId: 'h1', timings: 'Monday to Saturday, 11:00 to 15:00', rating: 4.5, reviews: 176, source: 'Apollo 24|7', checked: '22 Oct 2026' },
  { id: 'd5', name: 'Dr. Meera Nair', specialization: 'Paediatrics', qualifications: ['MBBS', 'MD (Paediatrics)'], experience: 11, hospitalId: 'h5', timings: 'Monday to Saturday, 09:30 to 13:30', rating: 4.9, reviews: 305, source: 'Tata 1mg', checked: '18 Oct 2026' },
  { id: 'd6', name: 'Dr. Sandeep Kulkarni', specialization: 'General Medicine', qualifications: ['MBBS', 'MD (General Medicine)'], experience: 20, hospitalId: 'h3', timings: 'Monday to Saturday, 09:00 to 12:00 and 17:00 to 19:00', rating: 4.4, reviews: 428, source: 'Tata 1mg', checked: '19 Oct 2026' },
  { id: 'd7', name: 'Dr. Priya Menon', specialization: 'Obstetrics and Gynaecology', qualifications: ['MBBS', 'MS (Obstetrics and Gynaecology)'], experience: 15, hospitalId: 'h3', timings: 'Monday, Wednesday and Friday, 10:00 to 14:00', rating: 4.7, reviews: 262, source: 'Tata 1mg', checked: '19 Oct 2026' },
  { id: 'd8', name: 'Dr. Arjun Varma', specialization: 'Pulmonology', qualifications: ['MBBS', 'MD (Respiratory Medicine)'], experience: 10, hospitalId: 'h2', timings: 'Monday to Friday, 15:00 to 18:00', rating: 4.5, reviews: 133, source: 'Apollo 24|7', checked: '21 Oct 2026' },
  { id: 'd9', name: 'Dr. Lakshmi Prasad', specialization: 'Ophthalmology', qualifications: ['MBBS', 'MS (Ophthalmology)'], experience: 16, hospitalId: 'h7', timings: 'Monday to Saturday, 09:00 to 13:00', rating: 4.6, reviews: 219, source: 'Tata 1mg', checked: '20 Oct 2026' },
  { id: 'd10', name: 'Dr. Rahul Desai', specialization: 'Gastroenterology', qualifications: ['MBBS', 'MD (General Medicine)', 'DM (Gastroenterology)'], experience: 13, hospitalId: 'h4', timings: 'Tuesday to Saturday, 10:00 to 13:00', rating: 4.5, reviews: 187, source: 'Apollo 24|7', checked: '23 Oct 2026' },
  { id: 'd11', name: 'Dr. Neha Kapoor', specialization: 'ENT', qualifications: ['MBBS', 'MS (ENT)'], experience: 8, hospitalId: null, clinic: 'Kapoor ENT Clinic, Ameerpet', area: 'Ameerpet', x: 414, y: 288, timings: 'Monday to Saturday, 17:00 to 20:00', rating: 4.4, reviews: 96, source: 'Tata 1mg', checked: '16 Oct 2026' },
];

export function hospitalNameFor(doctor) {
  return doctor.hospitalId ? HOSPITALS.find((x) => x.id === doctor.hospitalId)?.name ?? '' : doctor.clinic;
}

export const SPECIALITIES =[...new Set(DOCTORS.map((d) => d.specialization).concat(HOSPITALS.flatMap((h) => h.specialities)))].sort();

export const MEDICINES = [
  { id: 'm1', name: 'Paracetamol 650 mg', form: 'Tablet', pack: 'Strip of 15 tablets', rx: false, listings: [['Apollo Pharmacy', 33.5], ['MedPlus', 30.8], ['Tata 1mg', 31.9]] },
  { id: 'm2', name: 'Cetirizine 10 mg', form: 'Tablet', pack: 'Strip of 10 tablets', rx: false, listings: [['Apollo Pharmacy', 21.0], ['MedPlus', 18.9], ['Tata 1mg', 19.4]] },
  { id: 'm3', name: 'Amoxicillin 500 mg', form: 'Capsule', pack: 'Strip of 10 capsules', rx: true, listings: [['Apollo Pharmacy', 98.0], ['MedPlus', 92.1], ['Tata 1mg', 95.6]] },
  { id: 'm4', name: 'Metformin 500 mg', form: 'Tablet', pack: 'Strip of 20 tablets', rx: true, listings: [['Apollo Pharmacy', 42.0], ['MedPlus', 38.7], ['Tata 1mg', 40.1]] },
  { id: 'm5', name: 'Pantoprazole 40 mg', form: 'Tablet', pack: 'Strip of 15 tablets', rx: true, listings: [['Apollo Pharmacy', 128.0], ['MedPlus', 119.5], ['Tata 1mg', 115.8]] },
  { id: 'm6', name: 'Oral rehydration salts', form: 'Powder', pack: 'Sachet of 21.8 g', rx: false, listings: [['Apollo Pharmacy', 22.0], ['MedPlus', 21.0], ['Tata 1mg', 20.5]] },
].map((m) => ({
  ...m,
  listings: m.listings
    .map(([platform, price]) => ({ platform, price, checked: '24 Oct 2026, 08:30' }))
    .sort((a, b) => a.price - b.price),
}));

export const PHARMACIES = [
  { id: 'p1', name: 'Wellcare Pharmacy', area: 'Ameerpet', x: 420, y: 274, hours: 'Open 24 hours', address: '7-1-28 Ameerpet Main Road, Hyderabad 500016', phone: '+91 40 4100 2101', rating: 4.4, reviews: 233, source: 'MedPlus', checked: '22 Oct 2026' },
  { id: 'p2', name: 'Lakeside Medicals', area: 'Begumpet', x: 505, y: 246, hours: '08:00 to 23:00', address: '2 Rasoolpura Road, Begumpet, Hyderabad 500016', phone: '+91 40 4100 2102', rating: 4.2, reviews: 118, source: 'MedPlus', checked: '22 Oct 2026' },
  { id: 'p3', name: 'Greenleaf Chemists', area: 'Madhapur', x: 214, y: 332, hours: '07:00 to 23:00', address: '41 Ayyappa Society Road, Madhapur, Hyderabad 500081', phone: '+91 40 4100 2103', rating: 4.5, reviews: 164, source: 'Apollo Pharmacy', checked: '20 Oct 2026' },
  { id: 'p4', name: 'Citymed Pharmacy', area: 'Secunderabad', x: 640, y: 206, hours: 'Open 24 hours', address: '9 Station Road, Secunderabad 500003', phone: '+91 40 4100 2104', rating: 4.1, reviews: 302, source: 'Apollo Pharmacy', checked: '21 Oct 2026' },
  { id: 'p5', name: 'Nizampet Health Store', area: 'Kukatpally', x: 306, y: 146, hours: '08:00 to 22:00', address: '15 Nizampet Road, Kukatpally, Hyderabad 500072', phone: '+91 40 4100 2105', rating: 4.3, reviews: 97, source: 'MedPlus', checked: '19 Oct 2026' },
  { id: 'p6', name: 'Charminar Medical Hall', area: 'Charminar', x: 626, y: 514, hours: '09:00 to 22:00', address: '22-7 Pathargatti, Charminar, Hyderabad 500002', phone: '+91 40 4100 2106', rating: 4.0, reviews: 141, source: 'Apollo Pharmacy', checked: '2 Sep 2026' },
];

export const DIAGNOSTICS = [
  { id: 'c1', name: 'Clearpath Diagnostics', area: 'Somajiguda', x: 458, y: 340, hours: '06:30 to 21:00', address: '6-3-347 Dwarakapuri Colony, Somajiguda, Hyderabad 500082', phone: '+91 40 4200 3101', tests: ['Complete blood count', 'Lipid profile', 'Thyroid profile', 'HbA1c', 'X-ray', 'Ultrasound'], rating: 4.5, reviews: 388, source: 'Tata 1mg', checked: '23 Oct 2026' },
  { id: 'c2', name: 'Precision Pathology Lab', area: 'Kukatpally', x: 290, y: 122, hours: '07:00 to 20:00', address: '4 KPHB Phase 3, Kukatpally, Hyderabad 500072', phone: '+91 40 4200 3102', tests: ['Complete blood count', 'Liver function test', 'Kidney function test', 'Vitamin D', 'HbA1c'], rating: 4.3, reviews: 210, source: 'Tata 1mg', checked: '21 Oct 2026' },
  { id: 'c3', name: 'Deccan Imaging Centre', area: 'Banjara Hills', x: 388, y: 398, hours: '07:00 to 22:00', address: 'Road No. 2, Banjara Hills, Hyderabad 500034', phone: '+91 40 4200 3103', tests: ['MRI', 'CT scan', 'X-ray', 'Ultrasound', 'Mammography'], rating: 4.6, reviews: 276, source: 'Apollo 24|7', checked: '22 Oct 2026' },
  { id: 'c4', name: 'Healthline Labs', area: 'Gachibowli', x: 132, y: 402, hours: '06:00 to 20:00', address: '12 Old Mumbai Highway, Gachibowli, Hyderabad 500032', phone: '+91 40 4200 3104', tests: ['Complete blood count', 'Thyroid profile', 'Lipid profile', 'Urine routine'], rating: 4.2, reviews: 159, source: 'Tata 1mg', checked: '20 Oct 2026' },
  { id: 'c5', name: 'Eastgate Diagnostics', area: 'Dilsukhnagar', x: 780, y: 456, hours: '07:00 to 21:00', address: '16-2 Kothapet Road, Dilsukhnagar, Hyderabad 500060', phone: '+91 40 4200 3105', tests: ['Complete blood count', 'ECG', 'X-ray', 'Ultrasound', 'HbA1c'], rating: 4.1, reviews: 183, source: 'Apollo 24|7', checked: '14 Aug 2026' },
];

export const PATIENT = {
  name: 'Ravi Kumar',
  phone: '+91 98765 00010',
  medicalId: { bloodGroup: 'B+', allergies: ['Penicillin'], notes: 'Type 2 diabetes, takes metformin.', shareWithCrew: true },
  contacts: [
    { id: 'k1', name: 'Lakshmi Kumar', relation: 'Spouse', phone: '+91 98765 00011' },
    { id: 'k2', name: 'Arun Kumar', relation: 'Brother', phone: '+91 98765 00012' },
  ],
};

export const REPORTS = [
  {
    id: 'r1', title: 'Complete blood count', kind: 'Lab report', file: 'cbc-oct-2026.pdf', uploaded: '18 Oct 2026', size: '412 KB',
    lab: 'Clearpath Diagnostics',
    values: [
      { name: 'Haemoglobin', value: '11.2', unit: 'g/dL', range: '12.0 to 15.5', flag: 'Low' },
      { name: 'Total white cell count', value: '7,800', unit: 'cells/µL', range: '4,000 to 11,000', flag: null },
      { name: 'Platelet count', value: '2.6', unit: 'lakh/µL', range: '1.5 to 4.5', flag: null },
      { name: 'Mean corpuscular volume (MCV)', value: '76', unit: 'fL', range: '80 to 100', flag: 'Low' },
      { name: 'Red cell count', value: '4.4', unit: 'million/µL', range: '3.8 to 5.2', flag: null },
    ],
    summary: 'This is a complete blood count, a common test that counts the different cells in your blood. Most values are inside the ranges printed on the report. Two values, haemoglobin and MCV, are below the report’s range, and the report marks them as low. Only a doctor who knows your history can say what this means for you.',
    terms: [
      { term: 'Haemoglobin', meaning: 'The protein in red blood cells that carries oxygen around the body.' },
      { term: 'MCV', meaning: 'The average size of your red blood cells.' },
      { term: 'Platelets', meaning: 'Small cells that help blood to clot.' },
      { term: 'Reference range', meaning: 'The range the laboratory uses for comparison. It can differ between laboratories.' },
    ],
    questions: [
      'Do my low haemoglobin and MCV values need follow up?',
      'Should this test be repeated, and when?',
      'Do I need any other tests?',
    ],
  },
  {
    id: 'r2', title: 'Lipid profile', kind: 'Lab report', file: 'lipid-sep-2026.pdf', uploaded: '2 Sep 2026', size: '286 KB',
    lab: 'Precision Pathology Lab',
    values: [
      { name: 'Total cholesterol', value: '214', unit: 'mg/dL', range: 'Below 200', flag: 'High' },
      { name: 'LDL cholesterol', value: '138', unit: 'mg/dL', range: 'Below 130', flag: 'High' },
      { name: 'HDL cholesterol', value: '46', unit: 'mg/dL', range: '40 or above', flag: null },
      { name: 'Triglycerides', value: '148', unit: 'mg/dL', range: 'Below 150', flag: null },
    ],
    summary: 'This is a lipid profile, which measures fats in your blood. Total cholesterol and LDL cholesterol are above the ranges printed on the report, and the report marks them as high. HDL cholesterol and triglycerides are inside their ranges. A doctor can explain what these numbers mean for you.',
    terms: [
      { term: 'LDL cholesterol', meaning: 'A type of cholesterol often described as the kind that can build up in blood vessels.' },
      { term: 'HDL cholesterol', meaning: 'A type of cholesterol that helps carry cholesterol away from blood vessels.' },
      { term: 'Triglycerides', meaning: 'A type of fat in the blood that the body uses for energy.' },
    ],
    questions: ['What do my cholesterol values mean for me?', 'When should I test again?'],
  },
  {
    id: 'r3', title: 'Chest X-ray report', kind: 'Scan', file: 'chest-xray-jul-2026.pdf', uploaded: '12 Jul 2026', size: '1.2 MB',
    lab: 'Deccan Imaging Centre',
    values: [],
    summary: 'This is a written report about a chest X-ray. It describes the lungs, heart outline and bones seen on the image. The report states no abnormal finding. Ask the doctor who requested the X-ray if you have questions about it.',
    terms: [
      { term: 'Impression', meaning: 'The radiologist’s short conclusion at the end of the report.' },
      { term: 'Costophrenic angles', meaning: 'The lower corners of the lungs, where they meet the diaphragm.' },
    ],
    questions: ['Is any follow up needed?'],
  },
];

export const HISTORY = [
  { id: 'em_2041', date: '3 Aug 2026', type: 'Accident or injury', area: 'Ameerpet', ambulance: 'BLS, TS 09 UB 2210', status: 'completed', arrival: '9 min', rating: 5 },
  { id: 'em_1873', date: '14 Mar 2026', type: 'Something else', area: 'Begumpet', ambulance: 'Not assigned', status: 'cancelled', arrival: null, rating: null },
];

export const AMBULANCE = {
  registration: 'TS 09 EA 4521', type: 'ALS', operator: 'Deccan Ambulance Services', driver: 'Suresh Babu', driverPhone: '+91 98765 00031',
  start: { x: 650, y: 214 },
};

// Route from the ambulance's start to the patient, then on to a hospital.
export const ROUTE_TO_PATIENT = [[650, 214], [618, 222], [585, 238], [548, 246], [512, 256], [478, 262]];
export const ROUTE_TO_HOSPITAL = [[478, 262], [474, 250], [470, 238]];

export const ADMIN = {
  kpis: [
    { label: 'Active emergencies', value: '3' },
    { label: 'Requests today', value: '18' },
    { label: 'Average time to assign', value: '1 min 42 s' },
    { label: 'Failed matches today', value: '1' },
  ],
  responseByHour: [
    { hour: '06', minutes: 9.4 }, { hour: '08', minutes: 12.1 }, { hour: '10', minutes: 13.6 }, { hour: '12', minutes: 11.2 },
    { hour: '14', minutes: 10.4 }, { hour: '16', minutes: 12.8 }, { hour: '18', minutes: 15.3 }, { hour: '20', minutes: 13.1 },
    { hour: '22', minutes: 9.8 },
  ],
  activeCases: [
    { id: 'em_2117', area: 'Kukatpally', type: 'Accident or injury', status: 'failed', since: '6 min', ambulance: 'None accepted' },
    { id: 'em_2119', area: 'Begumpet', type: 'Heart or chest pain', status: 'en_route', since: '4 min', ambulance: 'ALS, TS 09 EA 4521' },
    { id: 'em_2120', area: 'Madhapur', type: 'Something else', status: 'matching', since: '1 min', ambulance: 'Offer 2 of 5' },
    { id: 'em_2114', area: 'Dilsukhnagar', type: 'Accident or injury', status: 'picked_up', since: '22 min', ambulance: 'BLS, TS 08 UA 7781' },
  ],
  users: [
    { name: 'Ravi Kumar', email: 'ravi.kumar@mail.example', role: 'Patient', joined: '2 Jan 2026', state: 'Active' },
    { name: 'Suresh Babu', email: 'suresh.babu@mail.example', role: 'Driver', joined: '14 Feb 2026', state: 'Active' },
    { name: 'Meena Joshi', email: 'meena.joshi@mail.example', role: 'Patient', joined: '9 Apr 2026', state: 'Active' },
    { name: 'Imran Shaikh', email: 'imran.shaikh@mail.example', role: 'Driver', joined: '30 May 2026', state: 'Disabled' },
    { name: 'Kavya Reddy', email: 'kavya.reddy@mail.example', role: 'Admin', joined: '1 Jan 2026', state: 'Active' },
    { name: 'Rohit Singh', email: 'rohit.singh@mail.example', role: 'Patient', joined: '19 Oct 2026', state: 'Active' },
  ],
};

export const STATUS_TEXT = {
  matching: 'Finding the nearest ambulance.',
  assigned: 'An ambulance has accepted.',
  en_route: 'The ambulance is on its way.',
  arrived: 'The ambulance is at your location.',
  picked_up: 'You are on board. On the way to the hospital.',
  at_hospital: 'Arrived at the hospital.',
  completed: 'The trip is complete. You can leave feedback.',
  cancelled: 'This request was cancelled.',
  failed: 'We could not reach an ambulance. Call 112 now.',
};

export const STATUS_LABEL = {
  matching: 'Matching', assigned: 'Assigned', en_route: 'En route', arrived: 'Arrived', picked_up: 'Picked up',
  at_hospital: 'At hospital', completed: 'Completed', cancelled: 'Cancelled', failed: 'No ambulance found',
};
