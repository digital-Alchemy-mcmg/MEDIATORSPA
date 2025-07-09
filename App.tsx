
import React, { useState, useCallback, useEffect } from 'react';
import { DebatePhase, Role, Message, Scores, Turn, AiTurnResponse, FinalReportData, PlayerStats } from './types';
import { DEBATE_STRUCTURE } from './constants';
import { processTurn, generateFinalReport } from './services/geminiService';
import SetupScreen from './components/SetupScreen';
import DebateArena from './components/DebateArena';
import FinalReport from './components/FinalReport';
import Spinner from './components/Spinner';

const App: React.FC = () => {
  const [phase, setPhase] = useState<DebatePhase>(DebatePhase.Setup);
  const [topic, setTopic] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [scores, setScores] = useState<Scores>({
    [Role.For]: { score: 0, bestQuote: null, fallacyWarnings: 0 },
    [Role.Against]: { score: 0, bestQuote: null, fallacyWarnings: 0 },
  });
  const [finalReport, setFinalReport] = useState<FinalReportData | null>(null);

  const currentTurn = DEBATE_STRUCTURE[turnIndex] || null;

  const addMessage = (role: Role, content: string, analysis?: AiTurnResponse) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, content, analysis }]);
  };

  const handleStartDebate = useCallback((newTopic: string) => {
    setTopic(newTopic);
    setPhase(DebatePhase.InProgress);
    setIsLoading(true);
  }, []);
  
  const startDebateFlow = useCallback(() => {
    if (phase === DebatePhase.InProgress && messages.length === 0) {
        addMessage(
            Role.Moderator,
            `Welcome to the debate on the topic: "${topic}".\n\nThe structure will be 3 rounds: Opening, Rebuttal, and Closing statements.\n\nLet's begin Round 1. The first turn goes to the **FOR** side for their opening statement.`
        );
        setIsLoading(false);
    }
  }, [phase, topic, messages.length]);

  useEffect(() => {
    if (isLoading && phase === DebatePhase.InProgress) {
        // This effect will run once when the debate starts
        const timer = setTimeout(() => {
            startDebateFlow();
        }, 1500); // Simulate moderator getting ready
        return () => clearTimeout(timer);
    }
  }, [isLoading, phase, startDebateFlow]);


  const handleArgumentSubmit = async (argument: string) => {
    if (!currentTurn) return;
    
    setIsLoading(true);
    addMessage(currentTurn.role, argument);
    
    const aiResponse = await processTurn(topic, messages, currentTurn, argument);
    
    if (aiResponse) {
        // Update scores
        setScores(prevScores => {
            const newScores: Scores = JSON.parse(JSON.stringify(prevScores)); // Deep copy
            let playerStats: PlayerStats = newScores[currentTurn.role];

            aiResponse.scores.forEach(s => {
                playerStats.score += s.points;
            });

            if (aiResponse.fallacyWarning) {
                playerStats.fallacyWarnings += 1;
            }

            if (aiResponse.bestQuoteCandidate && !playerStats.bestQuote) {
                 // Simple logic: first good candidate becomes the best quote.
                 // A more complex logic could re-evaluate this over time.
                 if (aiResponse.scores.some(s => s.reason.toLowerCase().includes('best quote'))) {
                    playerStats.bestQuote = aiResponse.bestQuoteCandidate;
                 }
            }
            return newScores;
        });

      const nextTurnIndex = turnIndex + 1;
      if (nextTurnIndex < DEBATE_STRUCTURE.length) {
        const nextTurn = DEBATE_STRUCTURE[nextTurnIndex];
        addMessage(
          Role.Moderator,
          `Thank you. The turn now passes to the **${nextTurn.role}** side for their ${nextTurn.type} statement.`,
          aiResponse
        );
        setTurnIndex(nextTurnIndex);
      } else {
        addMessage(
            Role.Moderator,
            `All rounds are complete. Thank you both for a spirited debate. I will now analyze the complete transcript and prepare the final report.`,
            aiResponse
        );
        // End of debate, generate final report
        const report = await generateFinalReport(topic, [...messages, {id: 'final', role: currentTurn.role, content: argument}]);
        if (report) {
            setFinalReport(report);
            setPhase(DebatePhase.Finished);
        } else {
            addMessage(Role.Moderator, "There was an error generating the final report. The debate will conclude here.");
            setPhase(DebatePhase.Finished); // End anyway
        }
      }
    } else {
      addMessage(Role.Moderator, "I'm having trouble analyzing that argument. Let's move to the next turn.");
       const nextTurnIndex = turnIndex + 1;
       if (nextTurnIndex < DEBATE_STRUCTURE.length) {
         setTurnIndex(nextTurnIndex);
       } else {
         setPhase(DebatePhase.Finished);
       }
    }
    
    setIsLoading(false);
  };
  
  const handleRestart = () => {
    setPhase(DebatePhase.Setup);
    setTopic('');
    setMessages([]);
    setTurnIndex(0);
    setIsLoading(false);
    setScores({
        [Role.For]: { score: 0, bestQuote: null, fallacyWarnings: 0 },
        [Role.Against]: { score: 0, bestQuote: null, fallacyWarnings: 0 },
    });
    setFinalReport(null);
  };

  const getFullHistoryText = () => {
    return messages.map(msg => {
        let entry = `${msg.role}: ${msg.content}`;
        if(msg.analysis) {
            entry += `\n[ANALYSIS]: ${JSON.stringify(msg.analysis, null, 2)}`;
        }
        return entry;
    }).join('\n\n---\n\n');
  }

  const renderContent = () => {
    switch (phase) {
      case DebatePhase.Setup:
        return <SetupScreen onStartDebate={handleStartDebate} />;
      case DebatePhase.InProgress:
        if(isLoading && messages.length === 0){
             return <div className="w-screen h-screen flex items-center justify-center"><Spinner text="Initializing debate..." size="lg" /></div>;
        }
        return (
          <DebateArena
            messages={messages}
            scores={scores}
            currentTurn={currentTurn}
            isLoading={isLoading}
            topic={topic}
            onArgumentSubmit={handleArgumentSubmit}
          />
        );
      case DebatePhase.Finished:
        if (finalReport) {
          return <FinalReport report={finalReport} topic={topic} onRestart={handleRestart} fullHistory={getFullHistoryText()} />;
        }
        return <div className="w-screen h-screen flex items-center justify-center"><Spinner text="Generating final report..." size="lg" /></div>; // Fallback
      default:
        return <div>Something went wrong.</div>;
    }
  };

  return <div className="bg-slate-900 min-h-screen">{renderContent()}</div>;
};

export default App;
