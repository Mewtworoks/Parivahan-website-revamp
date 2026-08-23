import type { CaptchaQuestion, TheoryQuestion } from '../types';

export const QUESTIONS: TheoryQuestion[] = [
  {
    q: 'A triangular sign with a red border showing a bend to the right means:',
    a: ['Right hand curve ahead', 'Right turn prohibited', 'One-way road to the right'], c: 0,
    ex: 'Triangular red-bordered signs are cautionary. They warn you about the road ahead, they do not order you to do anything.',
  },
  {
    q: 'You are approaching an unmarked crossroad at the same time as a vehicle on your right. Who goes first?',
    a: ['You do', 'The vehicle on your right', 'Whoever is faster'], c: 1,
    ex: 'At an uncontrolled junction, give way to traffic coming from your right.',
  },
  {
    q: 'The maximum permitted blood alcohol level while driving in India is:',
    a: ['30 mg per 100 ml', '80 mg per 100 ml', 'Zero for all drivers'], c: 0,
    ex: 'The legal limit is 30 mg of alcohol per 100 ml of blood. For commercial drivers it is zero.',
  },
  {
    q: 'A flashing amber traffic light means:',
    a: ['Stop and wait for green', 'Slow down and proceed with caution', 'The signal is out of order, ignore it'], c: 1,
    ex: 'Flashing amber asks you to slow down, check the junction and cross carefully.',
  },
  {
    q: 'You may overtake another vehicle:',
    a: ['On a bend, if the road looks empty', 'From the left, if the vehicle is slow', 'From the right, when the road ahead is clear'], c: 2,
    ex: 'Overtaking is done from the right, only when you can see the road ahead is clear.',
  },
];

// The official form ends on a distorted-text captcha. Kept, because a public form does need
// abuse protection — but as a plain arithmetic or word question that a screen reader can read,
// with a spoken option and a fresh question on demand. No warped letters.
export const CAPTCHA_QUESTIONS: CaptchaQuestion[] = [
  { q: 'How many wheels does a motorcycle have?', a: ['2'] },
  { q: 'Type the word ROAD in lower case', a: ['road'] },
  { q: 'What is four plus three?', a: ['7', 'seven'] },
  { q: 'Which is the odd one out — car, bus, table?', a: ['table'] },
  { q: 'How many letters are in the word LICENCE?', a: ['7', 'seven'] },
];
