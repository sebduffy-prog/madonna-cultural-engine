// Social Listening — DISABLED
// Awaiting platform API integration. No searches running.
// All social listening logic has been moved to the media trend index.

export default async function handler(req, res) {
  res.status(200).json({
    disabled: true,
    message: "Social listening is being rebuilt with platform APIs. Use the Media tab for trend tracking.",
    platforms: [],
    items: [],
    index: 0,
    sentiment: { positive: 0, negative: 0, neutral: 100, positiveCount: 0, negativeCount: 0, neutralCount: 0, total: 0 },
  });
}
