import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import RoomManager from './RoomManager'
import MatchingSystem from './MatchingSystem'
import './App.css'

function App() {
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
                <h1>Supabase Matcher</h1>
                {session && (
                    <div className="user-badge">
                        <span>{session.user.email}</span>
                        <button onClick={() => supabase.auth.signOut()} className="btn-logout">Salir</button>
                    </div>
                )}
            </header>

            <main className="app-main">
                {!session ? (
                    <Auth />
                ) : (
                    <div className="dashboard">
                        <div className="tab-navigation">
                            <button
                                className={activeTab === 'rooms' ? 'tab-btn active' : 'tab-btn'}
                                onClick={() => setActiveTab('rooms')}
                            >
                                Salas
                            </button>
                            <button
                                className={activeTab === 'matching' ? 'tab-btn active' : 'tab-btn'}
                                onClick={() => setActiveTab('matching')}
                            >
                                Matching
                            </button>
                        </div>

                        {activeTab === 'rooms' ? (
                            <RoomManager user={session.user} />
                        ) : (
                            <MatchingSystem user={session.user} />
                        )}
                    </div>
                )}
            </main>

            <footer className="status-bar">
                <div className="sync-indicator">
                    <span className="dot pulse"></span>
                    <span>Sincronizado</span>
                </div>
            </footer>
        </div>
    )
}

export default App
