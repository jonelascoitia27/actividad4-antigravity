import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, X, RefreshCw, Star, Info } from 'lucide-react'
import { supabase } from './supabaseClient'

export default function MatchingSystem({ user }) {
    const [potentialMatches, setPotentialMatches] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [matchNotification, setMatchNotification] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPotentialMatches()
        subscribeToMatches()
    }, [])

    const fetchPotentialMatches = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', user.id)
            .limit(10)

        if (data) setPotentialMatches(data)
        setLoading(false)
    }

    const subscribeToMatches = () => {
        supabase
            .channel('my_matches')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'matches',
                filter: `user_b=eq.${user.id}`
            }, payload => {
                if (payload.new.status === 'matched') {
                    setMatchNotification(`¡Nuevo Match detectado!`)
                }
            })
            .subscribe()
    }

    const handleSwipe = async (direction, targetUserId) => {
        if (direction === 'right') {
            const { data: existingLike } = await supabase
                .from('matches')
                .select('*')
                .eq('user_a', targetUserId)
                .eq('user_b', user.id)
                .single()

            if (existingLike) {
                await supabase
                    .from('matches')
                    .update({ status: 'matched' })
                    .eq('id', existingLike.id)
                setMatchNotification('¡Es un Match Perfecto!')
            } else {
                await supabase
                    .from('matches')
                    .upsert({ user_a: user.id, user_b: targetUserId, status: 'pending' })
            }
        }
        setCurrentIndex(prev => prev + 1)
    }

    if (loading) return (
        <div className="loading-container">
            <RefreshCw className="spinner" />
            <p>Buscando perfiles cerca de ti...</p>
        </div>
    )

    if (currentIndex >= potentialMatches.length) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card empty-state"
            >
                <div className="empty-icon-wrapper">
                    <Star size={48} className="star-icon" />
                </div>
                <h3>¡Eso es todo por ahora!</h3>
                <p>Has visto todos los perfiles disponibles en tu área.</p>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="primary"
                    onClick={() => {
                        setCurrentIndex(0)
                        fetchPotentialMatches()
                    }}
                >
                    <RefreshCw size={18} />
                    <span>Recargar perfiles</span>
                </motion.button>
            </motion.div>
        )
    }

    const currentProfile = potentialMatches[currentIndex]

    return (
        <div className="matching-system">
            <AnimatePresence>
                {matchNotification && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="match-toast"
                    >
                        <Heart fill="currentColor" size={20} />
                        <span>{matchNotification}</span>
                        <button className="close-toast" onClick={() => setMatchNotification(null)}>×</button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="card-stack">
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={currentProfile.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                            x: currentIndex % 2 === 0 ? 300 : -300,
                            opacity: 0,
                            rotate: currentIndex % 2 === 0 ? 20 : -20
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="card swipe-card"
                    >
                        <div className="profile-image-section">
                            <div className="avatar-large">
                                {currentProfile.username?.[0] || 'U'}
                            </div>
                            <div className="profile-info-overlay">
                                <h3>{currentProfile.username || `Usuario ${currentProfile.id.slice(0, 5)}`}</h3>
                                <div className="online-badge">
                                    <span className="dot pulse"></span>
                                    En línea ahora
                                </div>
                            </div>
                        </div>

                        <div className="profile-details">
                            <p className="bio">
                                <Info size={14} style={{ marginRight: '8px' }} />
                                {currentProfile.bio || 'Este aventurero aún no ha escrito su biografía.'}
                            </p>
                        </div>

                        <div className="swipe-actions">
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="btn-swipe danger"
                                onClick={() => handleSwipe('left', currentProfile.id)}
                            >
                                <X size={28} />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="btn-swipe success"
                                onClick={() => handleSwipe('right', currentProfile.id)}
                            >
                                <Heart size={28} fill="currentColor" />
                            </motion.button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="matching-footer">
                <p>Perfil {currentIndex + 1} de {potentialMatches.length}</p>
            </div>
        </div>
    )
}
