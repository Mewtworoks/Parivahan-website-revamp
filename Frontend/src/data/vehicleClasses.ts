import type { VehicleClass } from '../types';

// MoRTH schedule, per class of vehicle.
export const LL_GRANT = 150;
export const LL_TEST = 50;

// Real schedule, read off an actual e-receipt: Rs.150 grant PER CLASS + Rs.50 LL test fee ONCE.
// Two classes therefore cost 300 + 50 = 350, not 400.
export const CLASSES: VehicleClass[] = [
  { id: 'MCWOG', code: 'MCWOG', name: 'Motorcycle without gear', nameHi: 'बिना गियर वाली मोटरसाइकिल', nameMr: 'गिअरशिवाय मोटरसायकल',
    note: 'Scooter or moped up to 50cc. Allowed from age 16.', noteHi: '50cc तक का स्कूटर या मोपेड। 16 साल की उम्र से मान्य।', noteMr: '50cc पर्यंतची स्कूटर किंवा मोपेड. वयाच्या 16 व्या वर्षापासून.', min: 16, fee: 150 },
  { id: 'MCWG', code: 'MCWG', name: 'Motorcycle with gear', nameHi: 'गियर वाली मोटरसाइकिल', nameMr: 'गिअरसह मोटरसायकल',
    note: 'Any geared motorcycle. Allowed from 18.', noteHi: 'कोई भी गियर वाली मोटरसाइकिल। 18 साल से मान्य।', noteMr: 'कोणतीही गिअरवाली मोटरसायकल. 18 व्या वर्षापासून.', min: 18, fee: 150 },
  { id: 'LMV-NT', code: 'LMV-NT', name: 'Light motor vehicle, non-transport', nameHi: 'हल्का मोटर वाहन, गैर-परिवहन', nameMr: 'हलके मोटर वाहन, अ-वाहतूक',
    note: 'Private car or jeep. Allowed from 18.', noteHi: 'निजी कार या जीप। 18 साल से मान्य।', noteMr: 'खाजगी कार किंवा जीप. 18 व्या वर्षापासून.', min: 18, fee: 150 },
  { id: 'E-RICK', code: 'E-RICKSHAW', name: 'E-rickshaw', nameHi: 'ई-रिक्शा', nameMr: 'ई-रिक्षा',
    note: 'Battery rickshaw, non-transport endorsement.', noteHi: 'बैटरी रिक्शा, गैर-परिवहन अनुमोदन।', noteMr: 'बॅटरी रिक्षा, अ-वाहतूक मान्यता.', min: 18, fee: 150 },
  { id: 'LMV-TR', code: 'LMV-TR', name: 'Light motor vehicle, transport', nameHi: 'हल्का मोटर वाहन, परिवहन', nameMr: 'हलके मोटर वाहन, वाहतूक',
    note: 'Taxi or goods carrier. Needs Form 1A medical certificate and age 20.', noteHi: 'टैक्सी या माल वाहन। फॉर्म 1A मेडिकल प्रमाणपत्र और 20 साल की उम्र चाहिए।', noteMr: 'टॅक्सी किंवा माल वाहक. फॉर्म 1A वैद्यकीय प्रमाणपत्र आणि वय 20 आवश्यक.', min: 20, fee: 150, medical: true },
];
