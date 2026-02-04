/**
 * Utility functions for adhkar feature
 */

/**
 * Mapping of exact category titles to short versions
 */
const TITLE_SHORTENINGS: Record<string, string> = {
  // Morning & Evening
  'Words of remembrance for morning and evening': 'Morning & Evening',

  // Sleep
  'What to say before sleeping': 'Before Sleep',
  'supplications for when you wake up': 'Waking Up',
  'What to do if you have a bad dream or nightmare': 'Bad Dreams',
  'What to say if you are afraid to go to sleep or feel lonely and depressed':
    'Fear of Sleep',
  'Invocation to say if you stir in the night': 'Stirring at Night',

  // Restroom & Ablution
  'Invocation for entering the restroom': 'Entering Restroom',
  'Invocation for leaving the restroom': 'Leaving Restroom',
  'What to say before performing ablution': 'Before Wudu',
  'What to say upon completing ablution': 'After Wudu',

  // Home
  'What to say when leaving the home': 'Leaving Home',
  'What to say when entering the home': 'Entering Home',

  // Mosque
  'Invocation for going to the mosque': 'Going to Mosque',
  'Invocation for entering the mosque': 'Entering Mosque',
  'Invocation for leaving the mosque': 'Leaving Mosque',
  'What to say upon hearing the Athan (call to prayer)': 'Hearing Adhan',

  // Prayer
  'Invocations for the beginning of the prayer': 'Opening Prayer',
  "Invocations during Ruki' (bowing in prayer)": 'During Ruku',
  "Invocations for rising from the Ruki'": 'Rising from Ruku',
  'Invocations during Sujood': 'During Sujood',
  'Invocations for sitting between two prostrations': 'Between Prostrations',
  'Invocation for At-Tashahhud (sitting in prayer)': 'Tashahhud',
  'How to recite blessings on the Prophet after the Tashahhud':
    'Salawat in Prayer',
  'Invocations after the final Tash-ahhud and before ending the prayer':
    'Before Salam',
  'What to say after completing the prayer': 'After Prayer',
  "Supplications for prostrating due to recitation of the Qur'an":
    'Sujood Tilawah',
  'Invocations for Qunut in the Witr prayer': 'Qunut',
  'What to say immediately following the Witr prayer': 'After Witr',
  'Invocation against the distractions of Satan during the prayer and recitation of the Quran':
    'Against Distraction',

  // Clothing
  'Invocation when getting dressed': 'Getting Dressed',
  'Invocation when putting on new clothes': 'New Clothes',
  'Invocations for someone who has put on new clothes': 'Complimenting Clothes',
  'What to say when undressing': 'Undressing',

  // Food & Drink
  'Invocations before eating': 'Before Eating',
  'Invocations after eating': 'After Eating',
  'Invocations for breaking the fast': 'Breaking Fast',
  'Invocation for a family who invites you to break your fast with them':
    'Iftar Invitation',
  "A dinner guest's invocation for his host": 'For Host',
  'Invocation for someone who gives you drink or offers it to you':
    'Offered Drink',
  'Invocation for someone who offers you food when you are fasting, which you decline':
    'Declining Food',

  // Travel
  'Invocation for traveling': 'Starting Travel',
  'Invocation for riding in a vehicle or on an animal': 'Riding Vehicle',
  'Glorifying and magnifying Allah on the journey': 'During Journey',
  "The traveler's invocation at dawn": 'Traveler at Dawn',
  'Invocation for a layover (stopping along the way) on the journey':
    'Travel Stop',
  'Invocation for entering a town or city': 'Entering Town',
  'What to say upon returning from a Journey': 'Returning Home',
  "The resident's invocations for the traveler": 'For Traveler',
  "The traveler's invocation for the one he leaves behind": 'Leaving Behind',
  'Invocation for when your vehicle or mount begins to fail': 'Vehicle Trouble',

  // Nature & Weather
  'Invocations for when the wind blows': 'Wind Blowing',
  'Invocation for when it rains': 'When Raining',
  'Supplication after it rains': 'After Rain',
  'Some invocations for rain': 'Seeking Rain',
  'Invocation for the withholding of the rain': 'Drought',
  'Invocation for when it thunder': 'Thunder',
  'Invocation for sighting the new moon': 'New Moon',
  'Invocation for when you see the first dates of the season': 'First Fruits',

  // Social
  'spreading the greetings of Salam (Peace)': 'Giving Salam',
  'How to reply to a disbeliever if he says Salam to you':
    'Responding to Salam',
  'Invocation for sneezing': 'Sneezing',
  'What to say to the disbeliever if he sneezes and praises Allah':
    'Others Sneezing',
  'Invocation for someone who does good to you': 'Thanking Others',
  'Invocation for someone who tells you I love you for the sake of Allah':
    'Love for Allah',
  'Invocation for someone who tells you: May Allah bless you':
    'Receiving Blessing',
  'vocation for someone who says: May Allah forgive you':
    'Receiving Forgiveness',
  'Invocation for someone you have spoken ill to': 'After Backbiting',
  'Invocation for someone who offers you a share of his wealth':
    'Offered Wealth',
  'How a Muslim should praise another Muslim': 'Praising Others',
  'What a Muslim should say when he is praised': 'Being Praised',
  'What to say if you see someone afflicted by misfortune': 'Seeing Misfortune',
  'What to say when you fear you may afflict something with the evil eye':
    'Avoiding Evil Eye',
  'The Expiation of Assembly - Kaffaratul-Majlis': 'Leaving Gathering',
  'What to say while sitting in an assembly': 'In Gatherings',
  'Types of goodness and good etiquette for community life':
    'Community Etiquette',

  // Emotions & Difficulties
  'Invocations in times of worry and grief': 'Worry & Grief',
  'Invocations for anguish': 'Anguish',
  'Invocation for anger': 'Anger',
  'Invocation for when tragedy strikes': 'Tragedy',
  'What to say if something happens to please you or to displease you':
    'Good or Bad News',
  'What to say when something that pleases you happens': 'Good News',
  'What to say when surprised or startled': 'Surprise',
  'What to say when you feel frightened': 'Fear',
  'Invocation for when something you dislike happens, or for when you fail to achieve what you attempt to do':
    'Disappointment',
  'Invocation for when you find something becoming difficult for you':
    'Difficulty',
  'What to say when you feel a pain in your body': 'Pain',
  'What to say when you are fasting and someone is rude to you':
    'Rudeness While Fasting',
  'What to say if you fear people may harm you': 'Fear of Harm',

  // Protection & Faith
  'Invocations against the Devil and his promptings': 'Against Shaytan',
  "What to say to foil the devil's plots": 'Foiling Shaytan',
  'Invocation for fear of Shirk': 'Fear of Shirk',
  'Invocations for if you are stricken by in your faith': 'Doubt in Faith',
  "Invocation for Allah's protection from the False Messiah": 'Against Dajjal',
  'Invocation against evil portent': 'Against Bad Omens',
  'Invocation against an enemy': 'Against Enemy',
  'Invocations against the oppression of rulers': 'Against Oppression',
  'Invocations for when you meet an adversary or a powerful ruler.':
    'Meeting Adversary',
  'Invocation upon hearing a dog barking in the night': 'Dog Barking',
  "Invocation upon hearing the cock's crow or the bray of a donkey":
    'Animals Calling',
  "How to seek Allah's protection for children": 'Protecting Children',

  // Remembrance & Worship
  'The excellence of remembering Allah': 'Excellence of Dhikr',
  "The excellence of asking for Allah's blessings upon the Prophet pbuh":
    'Excellence of Salawat',
  'How the Prophet glorified Allah': 'Glorifying Allah',
  'Repentance and seeking forgiveness': 'Istighfar',
  "Istikharah (seeking Allah's Counsel)": 'Istikharah',

  // Market & Business
  'Invocation for entering a market': 'Entering Market',
  'Invocations for the setting of a debt': 'Settling Debt',
  'Invocation (upon receipt of the loan) for someone who lends you money':
    'Receiving Loan',

  // Marriage
  'Invocation for the groom': 'For Groom',
  "The groom's supplication on the wedding night or when buying an animal":
    'Wedding Night',
  'Congratulations for new parents and how they should respond': 'New Parents',
  'Invocation to be recited before intercourse': 'Before Intimacy',

  // Sickness & Death
  'Invocations for visiting the sick': 'Visiting Sick',
  'The reward for visiting the sick': 'Reward of Visiting',
  'Invocations of the terminal ill': 'Terminal Illness',
  'What to encourage the dying person to say': 'For Dying Person',
  'Invocation for closing the eyes of the dead': 'Closing Eyes',
  'Invocations for the dead in the Funeral prayer': 'Janazah Prayer',
  'Invocations for a child in the Funeral prayer': 'Child Janazah',
  'Invocation for the bereaved': 'Condolences',
  'Invocation to be recited when placing the dead in his grave':
    'Placing in Grave',
  'Invocation to be recited after burying the dead': 'After Burial',
  'Invocation for visiting the graves': 'Visiting Graves',
  'What to say and do if you commit a sin': 'After Sinning',

  // Hajj & Umrah
  "The pilgrim's announcement of his arrival for Hajj or Umrah": 'Talbiyah',
  'Saying Allahu Akbar when passing the Black Stone': 'At Black Stone',
  'Invocation to be recited between the Yemenite Corner and the Black Stone':
    'Between Corners',
  'Invocation to be recited while standing at Safa and Marwah': 'Safa & Marwah',
  'Supplication to be recited at the sacred area of Muzdalifah':
    'At Muzdalifah',
  'Invocation to be recited on the Day of Arafat': 'Day of Arafat',
  'Saying Allahu Akbar while stoning the three pillars at Mina':
    'Stoning Jamarat',

  // Animals
  'What to say when slaughtering or sacrificing an animal': 'Slaughtering',
};

/**
 * Shortens a category title to 1-3 words
 * Uses exact mappings first, then falls back to pattern-based shortening
 */
export function shortenCategoryTitle(title: string): string {
  // Check exact match first (case-insensitive)
  const exactMatch = TITLE_SHORTENINGS[title];
  if (exactMatch) {
    return exactMatch;
  }

  // Also try lowercase version
  const lowerTitle = title.toLowerCase();
  for (const [key, value] of Object.entries(TITLE_SHORTENINGS)) {
    if (key.toLowerCase() === lowerTitle) {
      return value;
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
