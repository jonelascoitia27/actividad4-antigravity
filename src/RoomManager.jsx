import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LogIn, Users, DoorOpen, Hash, ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react'
import { supabase } from './supabaseClient'

export default function RoomManager({ user }) {
    const [rooms, setRooms] = useState([])
    const [newRoomName, setNewRoomName] = useState('')
    const [currentRoom, setCurrentRoom] = useState(null)
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(false)

    const [error, setError] = useState(null)

    useEffect(() => {
        fetchRooms()

        const subscription = supabase
            .channel('public:rooms')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, payload => {
                setRooms(prev => [payload.new, ...prev])
            })
            .subscribe()

        return () => subscription.unsubscribe()
    }, [])

    const fetchRooms = async () => {
        setError(null)
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) setError('No se pudieron cargar las salas.')
        if (data) setRooms(data)
    }

    const createRoom = async () => {
        if (!newRoomName) return
        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase
                .from('rooms')
                .insert([{ name: newRoomName, created_by: user.id }])
                .select()

            if (error) {
                if (error.code === '23505' || error.status === 409) {
                    throw new Error('Ya existe una sala con ese nombre. Prueba con otro.')
                }
                throw error
            }

            if (data) {
                setNewRoomName('')
                joinRoom(data[0].id)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const joinRoom = async (roomId) => {
        setError(null)
        const { error } = await supabase
            .from('room_members')
            .upsert({ room_id: roomId, user_id: user.id })

        if (!error) {
            setCurrentRoom(roomId)
            subscribeToMembers(roomId)
        } else {
            setError('Error al unirse a la sala.')
        }
    }

    const subscribeToMembers = (roomId) => {
        supabase
            .from('room_members')
            .select('user_id')
            .eq('room_id', roomId)
            .then(({ data }) => setMembers(data || []))

        supabase
            .channel(`room:${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'room_members',
                filter: `room_id=eq.${roomId}`
            }, () => {
                supabase
                    .from('room_members')
                    .select('user_id')
                    .eq('room_id', roomId)
                    .then(({ data }) => setMembers(data || []))
            })
            .subscribe()
    }

    return (
        <div className="room-container">
            <AnimatePresence mode="wait">
                {currentRoom ? (
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="card room-detail-card"
                    >
                        <header className="room-detail-header">
                            <button className="back-btn" onClick={() => setCurrentRoom(null)}>
                                <ArrowLeft size={18} />
                            </button>
                            <div className="title-group">
                                <Hash size={16} className="hash-icon" />
                                <h3>{rooms.find(r => r.id === currentRoom)?.name}</h3>
                            </div>
                        </header>

                        {error && (
                            <div className="error-message" style={{ marginBottom: '20px' }}>
                                <AlertCircle size={14} style={{ marginRight: '8px' }} />
                                {error}
                            </div>
                        )}

                        <div className="room-stats">
                            <Users size={16} />
                            <span>{members.length} integrantes activos</span>
                        </div>

                        <div className="member-scroll-area">
                            <ul className="member-list">
                                {members.map(m => (
                                    <motion.li
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={m.user_id}
                                        className={m.user_id === user.id ? 'current-user' : ''}
                                    >
                                        <div className="member-avatar">
                                            {m.user_id === user.id ? 'Tú' : 'U'}
                                        </div>
                                        <span>{m.user_id === user.id ? 'Tú (En línea)' : `Usuario ${m.user_id.slice(0, 8)}`}</span>
                                        <div className="indicator-dot"></div>
                                    </motion.li>
                                ))}
                            </ul>
                        </div>

                        <div className="room-actions">
                            <button className="primary outline" onClick={() => setCurrentRoom(null)}>
                                <DoorOpen size={18} />
                                <span>Salir de la sala</span>
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="card room-list-card"
                    >
                        <div className="list-header">
                            <div className="icon-title">
                                <MessageSquare size={20} className="header-icon" />
                                <h3>Salas Disponibles</h3>
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="error-message"
                                style={{ marginBottom: '20px' }}
                            >
                                <AlertCircle size={14} style={{ marginRight: '8px' }} />
                                {error}
                            </motion.div>
                        )}

                        <div className="create-room-form">
                            <div className="input-with-icon">
                                <input
                                    type="text"
                                    placeholder="Nueva sala fantástica..."
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="primary-icon-btn"
                                    onClick={createRoom}
                                    disabled={loading || !newRoomName}
                                >
                                    <Plus size={20} />
                                </motion.button>
                            </div>
                        </div>

                        <div className="room-scroll-area">
                            {rooms.length === 0 ? (
                                <div className="empty-rooms">
                                    <Hash size={32} />
                                    <p>No hay salas disponibles. ¡Sé el primero en crear una!</p>
                                </div>
                            ) : (
                                <div className="room-grid">
                                    {rooms.map(room => (
                                        <motion.div
                                            key={room.id}
                                            className="room-card-item"
                                            whileHover={{ scale: 1.02 }}
                                        >
                                            <div className="room-info">
                                                <span className="room-name">{room.name}</span>
                                                <span className="room-id">#{room.id.slice(0, 4)}</span>
                                            </div>
                                            <button className="join-btn" onClick={() => joinRoom(room.id)}>
                                                <LogIn size={16} />
                                                <span>Unirse</span>
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
