import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ArrowLeft, Send, Sparkles, BookOpen, FileText, Lightbulb, ClipboardList, Bot, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function CourseAskAI({ courseId, courseName, courseCode, currentTopic, onBack }) {
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your AI teaching assistant for ${courseName}. I have access to all course materials, the syllabus, and information about the current topic: "${currentTopic}". How can I help you today?`,
      timestamp: new Date(),
      isLoading: false
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [students, setStudents] = useState([]);
  const messagesEndRef = useRef(null);

  // Fetch students on mount (optional: used for the enrolled-students UI section)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const studentsRes = await fetch(`/api/students?course_id=${courseId}`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin',
        });

        if (studentsRes.ok) {
          const studentsData = await studentsRes.json();
          setStudents(studentsData.students || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, [courseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const normalizeSources = (rawSources) => {
    if (!Array.isArray(rawSources)) return [];
    return rawSources
      .map((s) => {
        if (typeof s === 'string') return s;
        if (s && typeof s === 'object') {
          return (
            s.title ||
            s.name ||
            s.material_title ||
            (s.course && (s.course.course_code || s.course.course_name)) ||
            (typeof s.id !== 'undefined' ? `Source ${s.id}` : null)
          );
        }
        return null;
      })
      .filter(Boolean);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const trimmed = input.trim();
    const lowerQuery = trimmed.toLowerCase();
    const showStudents =
      (lowerQuery.includes('show') && lowerQuery.includes('student')) ||
      lowerQuery.includes('students list') ||
      lowerQuery.includes('enrolled');

    const csrfToken = document
      ?.querySelector('meta[name="csrf-token"]')
      ?.getAttribute('content');

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date()
    };

    const assistantPlaceholder = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      sources: [],
      showStudents,
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setIsTyping(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
        },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          course_id: courseId,
          conversation_id: conversationId,
        }),
      });

      clearTimeout(timeoutId);

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        const errorText =
          (typeof data?.message === 'string' && data.message) ||
          (typeof data?.error === 'string' && data.error) ||
          `Request failed (HTTP ${res.status}).`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholder.id
              ? { ...m, content: errorText, sources: [], isLoading: false }
              : m
          )
        );
        return;
      }

      const llmText = typeof data?.response === 'string'
        ? data.response
        : 'Sorry, I could not generate a response.';
      const llmSources = normalizeSources(data?.sources);

      if (data?.conversation_id) {
        setConversationId(data.conversation_id);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantPlaceholder.id
            ? { ...m, content: llmText, sources: llmSources, isLoading: false }
            : m
        )
      );
    } catch (error) {
      console.error('AI request failed:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantPlaceholder.id
            ? {
                ...m,
                content: error?.name === 'AbortError'
                  ? 'Sorry — the AI request timed out. Please try again, or verify the AI server is running.'
                  : 'Sorry, I could not reach the AI service. Please make sure the AI server is running.',
                isLoading: false,
              }
            : m
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    {
      icon: BookOpen,
      text: 'Create a lesson plan',
      prompt: `Create a detailed lesson plan for ${currentTopic}`
    },
    {
      icon: ClipboardList,
      text: 'Generate quiz questions',
      prompt: `Generate 10 quiz questions about ${currentTopic}`
    },
    {
      icon: Lightbulb,
      text: 'Explain the topic',
      prompt: `Explain ${currentTopic} in simple terms for students`
    },
    {
      icon: FileText,
      text: 'Teaching strategies',
      prompt: `What are effective teaching strategies for ${currentTopic}?`
    }
  ];

  const handleQuickPrompt = (prompt) => {
    setInput(prompt);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{courseCode}</Badge>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Assistant
              </Badge>
            </div>
            <h1 className="text-xl font-semibold">{courseName}</h1>
            <p className="text-sm text-gray-500">Current Topic: {currentTopic}</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Quick Prompts - Show only at start */}
          {messages.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6"
            >
              {quickPrompts.map((prompt, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt.prompt)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-4 bg-white border border-gray-200 rounded-lg text-left hover:border-green-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <prompt.icon className="w-5 h-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{prompt.text}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{prompt.prompt}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                
                <div className={`max-w-2xl ${message.role === 'user' ? 'order-first' : ''}`}>
                  <Card className={message.role === 'user' ? 'bg-green-700 border-green-700' : 'bg-white'}>
                    <CardContent className="pt-4">
                      {message.isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="w-2 h-2 bg-green-600 rounded-full"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0.1 }}
                              className="w-2 h-2 bg-green-600 rounded-full"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                              className="w-2 h-2 bg-green-600 rounded-full"
                            />
                          </div>
                          <p className={`text-sm ${message.role === 'user' ? 'text-green-100' : 'text-gray-500'}`}>
                            Thinking...
                          </p>
                        </div>
                      ) : (
                        <div className={`${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h2: (props) => <h2 className="text-base font-semibold mt-3 mb-1" {...props} />,
                              h3: (props) => <h3 className="text-sm font-semibold mt-3 mb-1" {...props} />,
                              p: (props) => <p className="whitespace-pre-wrap text-sm leading-relaxed" {...props} />,
                              strong: (props) => <strong className="font-semibold" {...props} />,
                              ul: (props) => <ul className="list-disc pl-5 text-sm space-y-1" {...props} />,
                              ol: (props) => <ol className="list-decimal pl-5 text-sm space-y-1" {...props} />,
                              li: (props) => <li className="leading-relaxed" {...props} />,
                              blockquote: (props) => (
                                <blockquote className="border-l-4 border-green-600 pl-3 italic text-sm opacity-90" {...props} />
                              ),
                              code: (props) => <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-900 text-xs" {...props} />,
                              pre: (props) => <pre className="p-3 rounded bg-gray-100 overflow-x-auto text-xs" {...props} />,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                      
                      {message.showStudents && students.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Enrolled Students ({students.length})</p>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {students.map((student, idx) => (
                              <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                                <p className="font-medium text-gray-900">{student.name}</p>
                                <p className="text-xs text-gray-600">{student.email}</p>
                                {student.studentId && <p className="text-xs text-gray-500">ID: {student.studentId}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {message.showStudents && students.length === 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-500 italic">No students enrolled yet</p>
                        </div>
                      )}
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className={`mt-3 pt-3 border-t ${message.role === 'user' ? 'border-green-600' : 'border-gray-200'}`}>
                          <p className={`text-xs font-semibold mb-1 ${message.role === 'user' ? 'text-green-100' : 'text-gray-500'}`}>
                            📚 Sources:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {message.sources.map((source, idx) => (
                              <span key={idx} className={`text-xs px-2 py-1 rounded ${message.role === 'user' ? 'bg-green-600 text-green-100' : 'bg-blue-100 text-blue-700'}`}>
                                {typeof source === 'string' ? source : String(source)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Card className="border-2 border-gray-200 focus-within:border-green-600 transition-colors">
            <CardContent className="p-2">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={`Ask about ${courseName}...`}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="bg-green-700 hover:bg-green-800"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-gray-500 mt-2 text-center">
            AI assistant has access to course materials, syllabus, and current topic context
          </p>
        </div>
      </div>
    </div>
  );
}
