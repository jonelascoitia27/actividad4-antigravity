import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, X, RefreshCw, Star, Info, AlertCircle } from 'lucide-react'
import { supabase } from './supabaseClient'

/**
 * Componente que gestiona el sistema de emparejamiento (swipe cards).
 * Permite a los usuarios ver perfiles, dar "like" o "dislike" y detectar matches.
 * 
 * @component
 * @param {Object} props
 * @param {Object} props.user - El objeto de sesión del usuario actual.
 */
export default function MatchingSystem({ user }) {
    const [potentialMatches, setPotentialMatches] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [matchNotification, setMatchNotification] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        init()
    }, [])

    /**
     * Inicializa el sistema cargando perfiles.
     */
    const init = async () => {
        try {
            await fetchPotentialMatches()
            subscribeToMatches()
        } catch (err) {
            setError('Error al conectar con el servidor.')
        }
    }

    /**
     * Asegura que el usuario tenga un perfil creado antes de interactuar.
     */
    const ensureProfileExists = async () => {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single()

        if (!profile) {
            const username = user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 5)}`
            const { error: createError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    username: username,
                    bio: '¡Hola! Estoy buscando matches.'
                })

            if (createError) throw new Error('No se pudo inicializar tu perfil.')
        }
    }

    /**
     * Obtiene una lista de perfiles potenciales (excluyendo al usuario actual).
     */
    const fetchPotentialMatches = async () => {
        setLoading(true)
        setError(null)
        try {
            // 1. Obtener IDs con los que ya se interactuó (LIKE o DISLIKE)
            const { data: interactedData } = await supabase
                .from('matches')
                .select('user_a, user_b')
                .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

            const interactedIds = new Set()
            interactedData?.forEach(m => {
                interactedIds.add(m.user_a)
                interactedIds.add(m.user_b)
            })

            // 2. Buscar perfiles excluyendo al actual y a los interactuados
            let query = supabase
                .from('profiles')
                .select('*')
                .neq('id', user.id)

            const { data, error: fetchError } = await query.limit(50)

            if (fetchError) throw fetchError

            // 3. Filtrar localmente para mayor precisión (o usar not in si hay pocos interactuados)
            if (data) {
                const filtered = data.filter(p => !interactedIds.has(p.id))
                setPotentialMatches(filtered)
            }
        } catch (err) {
            setError('No se pudieron cargar los perfiles. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    /**
     * Escucha en tiempo real si el usuario recibe un match.
     */
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

    /**
     * Gestiona la acción de deslizar (Like/Dislike).
     * 
     * @param {string} direction - 'right' para Like, 'left' para Dislike.
     * @param {string} targetUserId - ID del usuario al que se le dio swipe.
     */
    const handleSwipe = async (direction, targetUserId) => {
        setError(null)
        try {
            // Garantizar perfil antes de swipe para evitar FK violations
            await ensureProfileExists()

            if (direction === 'right') {
                const { data: existingLike } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('user_a', targetUserId)
                    .eq('user_b', user.id)
                    .single()

                if (existingLike) {
                    const { error: updError } = await supabase
                        .from('matches')
                        .update({ status: 'matched' })
                        .eq('id', existingLike.id)

                    if (updError) throw updError
                    setMatchNotification('¡Es un Match Perfecto!')
                } else {
                    const { error: insError } = await supabase
                        .from('matches')
                        .upsert({ user_a: user.id, user_b: targetUserId, status: 'pending' })

                    if (insError) {
                        if (insError.code !== '23505') throw insError
                    }
                }
            }
            setCurrentIndex(prev => prev + 1)
        } catch (err) {
            setError('No se pudo procesar la acción. Verifica tu conexión.')
        }
    }

    if (loading) return (
        <div className="loading-container">
            <RefreshCw className="spinner" />
            <p>Buscando perfiles cerca de ti...</p>
        </div>
    )

    if (error) return (
        <div className="matching-error-view">
            <AlertCircle color="#ff4d4d" size={48} />
            <h3>Ocurrió un error</h3>
            <p>{error}</p>
            <button className="primary" onClick={init}>Intentar de nuevo</button>
        </div>
    )

    if (currentIndex >= potentialMatches.length) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="matching-empty-view"
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
                        className="swipe-card"
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
