import { useState, useEffect } from 'react'
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
        // In a real app, we would exclude users already swiped
        const { data } = await supabase
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
                    setMatchNotification(`¡Nuevo Match con el usuario ${payload.new.user_a.slice(0, 8)}!`)
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matches',
                filter: `user_a=eq.${user.id}`
            }, payload => {
                if (payload.new.status === 'matched') {
                    setMatchNotification(`¡Nuevo Match con el usuario ${payload.new.user_b.slice(0, 8)}!`)
                }
            })
            .subscribe()
    }

    const handleSwipe = async (direction, targetUserId) => {
        if (direction === 'right') {
            // Check if they liked us first
            const { data: existingLike } = await supabase
                .from('matches')
                .select('*')
                .eq('user_a', targetUserId)
                .eq('user_b', user.id)
                .single()

            if (existingLike) {
                // It's a match!
                await supabase
                    .from('matches')
                    .update({ status: 'matched' })
                    .eq('id', existingLike.id)

                setMatchNotification('¡Es un Match!')
            } else {
                // Insert our like
                await supabase
                    .from('matches')
                    .upsert({ user_a: user.id, user_b: targetUserId, status: 'pending' })
            }
        }

        setCurrentIndex(prev => prev + 1)
    }

    if (loading) return <div className="card">Cargando perfiles...</div>

    if (currentIndex >= potentialMatches.length) {
        return (
            <div className="card">
                <h3>Sin más perfiles</h3>
                <button className="primary" onClick={() => setCurrentIndex(0)}>Reiniciar</button>
            </div>
        )
    }

    const currentProfile = potentialMatches[currentIndex]

    return (
        <div className="matching-system">
            {matchNotification && (
                <div className="success-message match-toast">
                    {matchNotification}
                    <button className="link-button" onClick={() => setMatchNotification(null)}>Cerrar</button>
                </div>
            )}

            <div className="card swipe-card">
                <div className="profile-placeholder">
                    <div className="avatar-large">{currentProfile.username?.[0] || 'U'}</div>
                    <h3>{currentProfile.username || `Usuario ${currentProfile.id.slice(0, 5)}`}</h3>
                    <p className="bio">{currentProfile.bio || 'Sin biografía disponible.'}</p>
                </div>

                <div className="swipe-actions">
                    <button className="danger btn-swipe" onClick={() => handleSwipe('left', currentProfile.id)}>
                        ✘
                    </button>
                    <button className="success btn-swipe" onClick={() => handleSwipe('right', currentProfile.id)}>
                        ❤
                    </button>
                </div>
            </div>
        </div>
    )
}
