/**
 * English stop words and location names for keyword extraction.
 * Extracted from MT English assistant's extractKeywordsFallback.
 */

export const ENGLISH_LOCATIONS = [
  'Middletown', 'Newburgh', 'Goshen', 'Monroe', 'Wallkill', 'Chester',
  'Warwick', 'Cornwall', 'Highland Falls', 'Orange County', 'NY',
];

export const ENGLISH_STOP_PHRASES = [
  'please tell me', 'please help', 'please find', 'can you help', 'help me find', 'help me',
  'tell me about', 'show me', 'let me know', 'i need to know',
  'what are', 'what is', 'what does', 'where is', 'where are', 'where can i',
  'how do i', 'how can i', 'how to', 'how much', 'how many',
  'which one', 'which ones', 'who knows',
  'is there', 'are there', 'do you have', 'does anyone know',
  'find me', 'look for', 'looking for', 'search for', 'list all', 'list out',
  'recommend', 'recommend me', 'any recommendations', 'suggestions', 'suggest',
  'all the', 'some', 'a few', 'any good',
  'the best', 'best', 'good', 'great', 'top rated', 'highest rated',
  'ranking', 'rated', 'reviews', 'rating', 'score',
  'pretty good', 'really good', 'not bad', 'reliable', 'legit', 'reputable',
  'i want to eat', 'i want to buy', 'i want to find', 'i want to go', 'i want',
  'i would like', 'i need', 'want to eat', 'want to buy', 'want to find', 'want to go',
  'can i', 'should i', 'do you know', 'i heard', 'apparently', 'seems like',
  'local', 'nearby', 'around here', 'close by', 'in the area',
  'could you', 'would you', 'is it possible',
  'where to buy', 'where to find', 'where to go', 'where to get',
];

export const ENGLISH_STOP_WORDS = new Set([
  'i', 'me', 'my', 'you', 'your', 'he', 'she', 'it', 'we', 'they',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'of', 'by', 'from', 'with', 'and', 'or', 'but',
  'so', 'if', 'not', 'no', 'do', 'did', 'has', 'had', 'have',
  'this', 'that', 'these', 'those', 'some', 'any', 'all', 'each', 'every',
  'can', 'will', 'just', 'get', 'got', 'go', 'see', 'find', 'want', 'need',
  'good', 'also', 'very', 'really', 'too', 'more', 'most', 'much',
]);
