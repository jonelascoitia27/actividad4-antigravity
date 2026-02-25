import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User, Activity, Users, Sparkles } from 'lucide-react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import RoomManager from './RoomManager'
import MatchingSystem from './MatchingSystem'
import './App.css'

/**
 * Componente principal de la aplicación.
 * Gestiona el estado de la sesión, la navegación por pestañas y el layout global.
 * 
 * @component
 */
function App() {
    const [session, setSession] = useState(null)
    const [activeTab, setActiveTab] = useState('rooms')

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    return (
        <div className="app-container">
            <header className="app-header">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="logo-section"
                >
                    <Sparkles className="sparkle-icon" size={24} />
                    <h1>Supabase Matcher</h1>
                </motion.div>

                <AnimatePresence>
                    {session && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="user-badge"
                        >
                            <User size={16} />
                            <span>{session.user.email}</span>
                            <button onClick={() => supabase.auth.signOut()} className="btn-logout">
                                <LogOut size={14} />
                                <span>Salir</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            <main className="app-main">
                <AnimatePresence mode="wait">
                    {!session ? (
                        <motion.div
                            key="auth"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Auth />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="dashboard"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="dashboard card dashboard-card"
                        >
                            <div className="tab-navigation">
                                <button
                                    className={activeTab === 'rooms' ? 'tab-btn active' : 'tab-btn'}
                                    onClick={() => setActiveTab('rooms')}
                                >
                                    <Users size={18} />
                                    <span>Salas</span>
                                </button>
                                <button
                                    className={activeTab === 'matching' ? 'tab-btn active' : 'tab-btn'}
                                    onClick={() => setActiveTab('matching')}
                                >
                                    <Activity size={18} />
                                    <span>Matching</span>
                                </button>
                            </div>

                            <div className="tab-content">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'rooms' ? (
                                        <motion.div
                                            key="rooms"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <RoomManager user={session.user} />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="matching"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <MatchingSystem user={session.user} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <footer className="status-bar">
                <div className="sync-indicator">
                    <span className="dot pulse"></span>
                    <span>Sincronización en tiempo real activa</span>
                </div>
                <div className="version-info">
                    v2.0.0
                </div>
            </footer>
        </div>
    )
}

export default App
