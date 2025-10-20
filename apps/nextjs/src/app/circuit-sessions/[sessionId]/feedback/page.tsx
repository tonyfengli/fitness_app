"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@acme/ui-shared";

// Custom icons
const ChartBarIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const UsersIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const TrendingUpIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const ChatIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

// Mock aggregated data for 10 clients
const FEEDBACK_DATA = {
  totalResponses: 10,
  sessionName: "5PM Tuesday",
  sessionDate: "2024-01-16",
  challengeLevel: {
    too_easy: 2,
    just_right: 6,
    too_hard: 2,
  },
  favoriteRounds: {
    "Round 1": 4,
    "Round 2": 3,
    "Round 3": 2,
    "Round 4": 1,
  },
  leastEffectiveRounds: {
    "Round 1": 1,
    "Round 2": 1,
    "Round 3": 3,
    "Round 4": 5,
  },
  comments: [
    { id: 1, text: "Great variety of exercises! Round 1 really got my heart pumping.", client: "Sarah J." },
    { id: 2, text: "Round 4 felt a bit repetitive. Maybe mix up the core exercises?", client: "Mike C." },
    { id: 3, text: "Perfect challenge level. The rest periods were just right.", client: "Emily D." },
    { id: 4, text: "Would love more upper body work in Round 2.", client: "Alex R." },
    { id: 5, text: "The AMRAP round was intense! Maybe provide scaling options.", client: "Jessica W." },
  ],
  roundDetails: [
    { name: "Round 1", type: "Circuit", description: "High-intensity cardio circuits" },
    { name: "Round 2", type: "Stations", description: "Strength-focused stations" },
    { name: "Round 3", type: "AMRAP", description: "As many reps as possible" },
    { name: "Round 4", type: "Circuit", description: "Core and conditioning" },
  ],
};

interface SessionFeedbackPageProps {
  params: {
    sessionId: string;
  };
}

export default function SessionFeedbackPage({ params }: SessionFeedbackPageProps) {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<"overview" | "comments">("overview");

  // Calculate percentages for challenge level
  const challengeLevelPercentages = {
    too_easy: (FEEDBACK_DATA.challengeLevel.too_easy / FEEDBACK_DATA.totalResponses) * 100,
    just_right: (FEEDBACK_DATA.challengeLevel.just_right / FEEDBACK_DATA.totalResponses) * 100,
    too_hard: (FEEDBACK_DATA.challengeLevel.too_hard / FEEDBACK_DATA.totalResponses) * 100,
  };

  // Get the highest percentage for dominant response
  const dominantChallenge = Object.entries(challengeLevelPercentages).reduce((a, b) => 
    challengeLevelPercentages[a[0] as keyof typeof challengeLevelPercentages] > 
    challengeLevelPercentages[b[0] as keyof typeof challengeLevelPercentages] ? a : b
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Session Feedback
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {FEEDBACK_DATA.sessionName} • {new Date(FEEDBACK_DATA.sessionDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSelectedTab("overview")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              selectedTab === "overview"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Overview
            {selectedTab === "overview" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
          <button
            onClick={() => setSelectedTab("comments")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              selectedTab === "comments"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Comments ({FEEDBACK_DATA.comments.length})
            {selectedTab === "comments" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {selectedTab === "overview" ? (
          <div className="space-y-6">
            {/* Response Summary Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Response Summary</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{FEEDBACK_DATA.totalResponses} participants provided feedback</p>
                </div>
              </div>
            </div>

            {/* Challenge Level Analysis */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <ChartBarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Challenge Level</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {dominantChallenge[0] === "just_right" 
                      ? "Session difficulty is well-balanced" 
                      : dominantChallenge[0] === "too_easy"
                      ? "Consider increasing intensity"
                      : "Consider reducing difficulty"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {Object.entries(challengeLevelPercentages).map(([level, percentage]) => (
                  <div key={level} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 capitalize">
                        {level.replace('_', ' ')}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {FEEDBACK_DATA.challengeLevel[level as keyof typeof FEEDBACK_DATA.challengeLevel]} responses ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          level === "too_easy" ? "bg-green-500" :
                          level === "just_right" ? "bg-blue-500" :
                          "bg-orange-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Round Performance */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <TrendingUpIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Round Performance</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Participant preferences by round</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Most Effective Rounds */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Most Effective</h3>
                  <div className="space-y-3">
                    {Object.entries(FEEDBACK_DATA.favoriteRounds)
                      .sort(([,a], [,b]) => b - a)
                      .map(([round, votes], index) => {
                        const roundDetail = FEEDBACK_DATA.roundDetails.find(r => r.name === round);
                        return (
                          <div key={round} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              index === 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                              "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{round}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{votes} votes</span>
                              </div>
                              {roundDetail && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{roundDetail.type}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Needs Improvement */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Needs Improvement</h3>
                  <div className="space-y-3">
                    {Object.entries(FEEDBACK_DATA.leastEffectiveRounds)
                      .sort(([,a], [,b]) => b - a)
                      .map(([round, votes], index) => {
                        const roundDetail = FEEDBACK_DATA.roundDetails.find(r => r.name === round);
                        return (
                          <div key={round} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              index === 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                              "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{round}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{votes} votes</span>
                              </div>
                              {roundDetail && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{roundDetail.type}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Key Insights</h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>60%</strong> of participants found the workout intensity "just right"
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Round 1</strong> (High-intensity cardio) was the most popular with 40% of votes
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Round 4</strong> (Core and conditioning) needs attention - 50% found it least effective
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Consider adding more variety to core exercises based on participant feedback
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* Comments Tab */
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <ChatIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Participant Comments</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Direct feedback from your clients</p>
              </div>
            </div>

            {FEEDBACK_DATA.comments.map((comment) => (
              <div 
                key={comment.id} 
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{comment.client}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Participant</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  "{comment.text}"
                </p>
              </div>
            ))}

            {/* Summary of themes */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mt-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Common Themes</h3>
              <div className="flex flex-wrap gap-2">
                {["Exercise Variety", "Rest Periods", "Core Work", "Scaling Options", "Upper Body"].map(theme => (
                  <span 
                    key={theme}
                    className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}