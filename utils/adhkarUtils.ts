/**
 * Utility functions for adhkar feature
 */

// @ai-start
import i18n from '@/i18n';
import {currentLanguageConfig} from '@/i18n/language'; // @ai
import type enContent from '@/i18n/locales/en/content.json';
// @ai-end

// @ai-start
type ShortTitleKey = keyof (typeof enContent)['adhkarShortTitles'];
// @ai-end

/**
 * Mapping of exact category titles to short-title translation keys
 * (`content:adhkarShortTitles.*`)
 */
// @ai-start
const TITLE_SHORTENINGS: Record<string, ShortTitleKey> = {
  // Morning & Evening
  'Words of remembrance for morning and evening': 'morningAndEvening',

  // Sleep
  'What to say before sleeping': 'beforeSleep',
  'supplications for when you wake up': 'wakingUp',
  'What to do if you have a bad dream or nightmare': 'badDreams',
  'What to say if you are afraid to go to sleep or feel lonely and depressed':
    'fearOfSleep',
  'Invocation to say if you stir in the night': 'stirringAtNight',

  // Restroom & Ablution
  'Invocation for entering the restroom': 'enteringRestroom',
  'Invocation for leaving the restroom': 'leavingRestroom',
  'What to say before performing ablution': 'beforeWudu',
  'What to say upon completing ablution': 'afterWudu',

  // Home
  'What to say when leaving the home': 'leavingHome',
  'What to say when entering the home': 'enteringHome',

  // Mosque
  'Invocation for going to the mosque': 'goingToMosque',
  'Invocation for entering the mosque': 'enteringMosque',
  'Invocation for leaving the mosque': 'leavingMosque',
  'What to say upon hearing the Athan (call to prayer)': 'hearingAdhan',

  // Prayer
  'Invocations for the beginning of the prayer': 'openingPrayer',
  "Invocations during Ruki' (bowing in prayer)": 'duringRuku',
  "Invocations for rising from the Ruki'": 'risingFromRuku',
  'Invocations during Sujood': 'duringSujood',
  'Invocations for sitting between two prostrations': 'betweenProstrations',
  'Invocation for At-Tashahhud (sitting in prayer)': 'tashahhud',
  'How to recite blessings on the Prophet after the Tashahhud':
    'salawatInPrayer',
  'Invocations after the final Tash-ahhud and before ending the prayer':
    'beforeSalam',
  'What to say after completing the prayer': 'afterPrayer',
  "Supplications for prostrating due to recitation of the Qur'an":
    'sujoodTilawah',
  'Invocations for Qunut in the Witr prayer': 'qunut',
  'What to say immediately following the Witr prayer': 'afterWitr',
  'Invocation against the distractions of Satan during the prayer and recitation of the Quran':
    'againstDistraction',

  // Clothing
  'Invocation when getting dressed': 'gettingDressed',
  'Invocation when putting on new clothes': 'newClothes',
  'Invocations for someone who has put on new clothes': 'complimentingClothes',
  'What to say when undressing': 'undressing',

  // Food & Drink
  'Invocations before eating': 'beforeEating',
  'Invocations after eating': 'afterEating',
  'Invocations for breaking the fast': 'breakingFast',
  'Invocation for a family who invites you to break your fast with them':
    'iftarInvitation',
  "A dinner guest's invocation for his host": 'forHost',
  'Invocation for someone who gives you drink or offers it to you':
    'offeredDrink',
  'Invocation for someone who offers you food when you are fasting, which you decline':
    'decliningFood',

  // Travel
  'Invocation for traveling': 'startingTravel',
  'Invocation for riding in a vehicle or on an animal': 'ridingVehicle',
  'Glorifying and magnifying Allah on the journey': 'duringJourney',
  "The traveler's invocation at dawn": 'travelerAtDawn',
  'Invocation for a layover (stopping along the way) on the journey':
    'travelStop',
  'Invocation for entering a town or city': 'enteringTown',
  'What to say upon returning from a Journey': 'returningHome',
  "The resident's invocations for the traveler": 'forTraveler',
  "The traveler's invocation for the one he leaves behind": 'leavingBehind',
  'Invocation for when your vehicle or mount begins to fail': 'vehicleTrouble',

  // Nature & Weather
  'Invocations for when the wind blows': 'windBlowing',
  'Invocation for when it rains': 'whenRaining',
  'Supplication after it rains': 'afterRain',
  'Some invocations for rain': 'seekingRain',
  'Invocation for the withholding of the rain': 'drought',
  'Invocation for when it thunder': 'thunder',
  'Invocation for sighting the new moon': 'newMoon',
  'Invocation for when you see the first dates of the season': 'firstFruits',

  // Social
  'spreading the greetings of Salam (Peace)': 'givingSalam',
  'How to reply to a disbeliever if he says Salam to you': 'respondingToSalam',
  'Invocation for sneezing': 'sneezing',
  'What to say to the disbeliever if he sneezes and praises Allah':
    'othersSneezing',
  'Invocation for someone who does good to you': 'thankingOthers',
  'Invocation for someone who tells you I love you for the sake of Allah':
    'loveForAllah',
  'Invocation for someone who tells you: May Allah bless you':
    'receivingBlessing',
  'Invocation for someone who says: May Allah forgive you':
    'receivingForgiveness',
  'Invocation for someone you have spoken ill to': 'afterBackbiting',
  'Invocation for someone who offers you a share of his wealth':
    'offeredWealth',
  'How a Muslim should praise another Muslim': 'praisingOthers',
  'What a Muslim should say when he is praised': 'beingPraised',
  'What to say if you see someone afflicted by misfortune': 'seeingMisfortune',
  'What to say when you fear you may afflict something with the evil eye':
    'avoidingEvilEye',
  'The Expiation of Assembly - Kaffaratul-Majlis': 'leavingGathering',
  'What to say while sitting in an assembly': 'inGatherings',
  'Types of goodness and good etiquette for community life':
    'communityEtiquette',

  // Emotions & Difficulties
  'Invocations in times of worry and grief': 'worryAndGrief',
  'Invocations for anguish': 'anguish',
  'Invocation for anger': 'anger',
  'Invocation for when tragedy strikes': 'tragedy',
  'What to say if something happens to please you or to displease you':
    'goodOrBadNews',
  'What to say when something that pleases you happens': 'goodNews',
  'What to say when surprised or startled': 'surprise',
  'What to say when you feel frightened': 'fear',
  'Invocation for when something you dislike happens, or for when you fail to achieve what you attempt to do':
    'disappointment',
  'Invocation for when you find something becoming difficult for you':
    'difficulty',
  'What to say when you feel a pain in your body': 'pain',
  'What to say when you are fasting and someone is rude to you':
    'rudenessWhileFasting',
  'What to say if you fear people may harm you': 'fearOfHarm',

  // Protection & Faith
  'Invocations against the Devil and his promptings': 'againstShaytan',
  "What to say to foil the devil's plots": 'foilingShaytan',
  'Invocation for fear of Shirk': 'fearOfShirk',
  'Invocations for if you are stricken by in your faith': 'doubtInFaith',
  "Invocation for Allah's protection from the False Messiah": 'againstDajjal',
  'Invocation against evil portent': 'againstBadOmens',
  'Invocation against an enemy': 'againstEnemy',
  'Invocations against the oppression of rulers': 'againstOppression',
  'Invocations for when you meet an adversary or a powerful ruler.':
    'meetingAdversary',
  'Invocation upon hearing a dog barking in the night': 'dogBarking',
  "Invocation upon hearing the cock's crow or the bray of a donkey":
    'animalsCalling',
  "How to seek Allah's protection for children": 'protectingChildren',

  // Remembrance & Worship
  'The excellence of remembering Allah': 'excellenceOfDhikr',
  "The excellence of asking for Allah's blessings upon the Prophet pbuh":
    'excellenceOfSalawat',
  'How the Prophet glorified Allah': 'glorifyingAllah',
  'Repentance and seeking forgiveness': 'istighfar',
  "Istikharah (seeking Allah's Counsel)": 'istikharah',

  // Market & Business
  'Invocation for entering a market': 'enteringMarket',
  'Invocations for the setting of a debt': 'settlingDebt',
  'Invocation (upon receipt of the loan) for someone who lends you money':
    'receivingLoan',

  // Marriage
  'Invocation for the groom': 'forGroom',
  "The groom's supplication on the wedding night or when buying an animal":
    'weddingNight',
  'Congratulations for new parents and how they should respond': 'newParents',
  'Invocation to be recited before intercourse': 'beforeIntimacy',

  // Sickness & Death
  'Invocations for visiting the sick': 'visitingSick',
  'The reward for visiting the sick': 'rewardOfVisiting',
  'Invocations of the terminal ill': 'terminalIllness',
  'What to encourage the dying person to say': 'forDyingPerson',
  'Invocation for closing the eyes of the dead': 'closingEyes',
  'Invocations for the dead in the Funeral prayer': 'janazahPrayer',
  'Invocations for a child in the Funeral prayer': 'childJanazah',
  'Invocation for the bereaved': 'condolences',
  'Invocation to be recited when placing the dead in his grave':
    'placingInGrave',
  'Invocation to be recited after burying the dead': 'afterBurial',
  'Invocation for visiting the graves': 'visitingGraves',
  'What to say and do if you commit a sin': 'afterSinning',

  // Hajj & Umrah
  "The pilgrim's announcement of his arrival for Hajj or Umrah": 'talbiyah',
  'Saying Allahu Akbar when passing the Black Stone': 'atBlackStone',
  'Invocation to be recited between the Yemenite Corner and the Black Stone':
    'betweenCorners',
  'Invocation to be recited while standing at Safa and Marwah': 'safaAndMarwah',
  'Supplication to be recited at the sacred area of Muzdalifah': 'atMuzdalifah',
  'Invocation to be recited on the Day of Arafat': 'dayOfArafat',
  'Saying Allahu Akbar while stoning the three pillars at Mina':
    'stoningJamarat',

  // Animals
  'What to say when slaughtering or sacrificing an animal': 'slaughtering',
};
// @ai-end

/** Super-category label: Arabic title in Arabic mode, English otherwise. */
// @ai-start
export function getSuperCategoryDisplayTitle(category: {
  title: string;
  arabicTitle?: string | null;
}): string {
  if (currentLanguageConfig.bilingualContent === 'ar' && category.arabicTitle) {
    return category.arabicTitle;
  }
  return category.title;
}
// @ai-end

// @ai-start
export function shortenCategoryTitle(title: string): string {
  // Check exact match first (case-insensitive)
  const exactMatch = TITLE_SHORTENINGS[title];
  if (exactMatch) {
    return i18n.t(`content:adhkarShortTitles.${exactMatch}`);
  }

  // Also try lowercase version
  const lowerTitle = title.toLowerCase();
  for (const [key, value] of Object.entries(TITLE_SHORTENINGS)) {
    if (key.toLowerCase() === lowerTitle) {
      return i18n.t(`content:adhkarShortTitles.${value}`);
    }
  }

  // Pattern-based fallback
  let shortened = title;

  // Remove common prefixes
  shortened = shortened
    .replace(/^Invocations?\s+for\s+/i, '')
    .replace(/^Supplications?\s+for\s+/i, '')
    .replace(/^What to say\s+(when|if|upon|before|after)\s+/i, '')
    .replace(/^How to\s+/i, '')
    .replace(/^The\s+/i, '');

  // Remove common filler words
  shortened = shortened
    .replace(/\s+the\s+/gi, ' ')
    .replace(/\s+a\s+/gi, ' ')
    .replace(/\s+an\s+/gi, ' ')
    .replace(/\s+and\s+/gi, ' & ')
    .replace(/\s+or\s+/gi, '/')
    .replace(/\s+in\s+/gi, ' ')
    .replace(/\s+of\s+/gi, ' ')
    .replace(/\s+to\s+/gi, ' ')
    .replace(/\s+for\s+/gi, ' ')
    .replace(/\s+you\s+/gi, ' ')
    .replace(/\s+your\s+/gi, ' ');

  // Remove parenthetical content
  shortened = shortened.replace(/\s*\([^)]*\)\s*/g, ' ');

  // Clean up multiple spaces
  shortened = shortened.replace(/\s+/g, ' ').trim();

  // Capitalize first letter of each word
  shortened = shortened
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Limit to 3 words max
  const words = shortened.split(' ');
  if (words.length > 3) {
    shortened = words.slice(0, 3).join(' ');
  }

  return shortened || title;
}
// @ai-end
