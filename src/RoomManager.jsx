import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LogIn, Users, DoorOpen, Hash, ArrowLeft, MessageSquare, AlertCircle, Trash2, UserX } from 'lucide-react'
import { supabase } from './supabaseClient'

/**
 * Componente que gestiona las salas de chat y los miembros de las mismas.
 * Permite listar salas, crear nuevas, unirse y ver participantes en tiempo real.
 * 
 * @component
 * @param {Object} props
 * @param {Object} props.user - El objeto de sesión del usuario actual.
 */
export default function RoomManager({ user }) {
    const [rooms, setRooms] = useState([])
    const [newRoomName, setNewRoomName] = useState('')
    const [currentRoom, setCurrentRoom] = useState(null)
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(false)

    const [error, setError] = useState(null)

    useEffect(() => {
        fetchRooms()

        // Cleanup al cerrar la pestaña o navegar fuera
        const handleUnload = async () => {
            if (currentRoom) {
                await supabase
                    .from('room_members')
                    .delete()
                    .eq('room_id', currentRoom)
                    .eq('user_id', user.id)
            }
        }

        window.addEventListener('beforeunload', handleUnload)

        const subscription = supabase
            .channel('public:rooms')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchRooms)
            .subscribe()

        return () => {
            window.removeEventListener('beforeunload', handleUnload)
            handleUnload() // También al desmontar el componente
            subscription.unsubscribe()
        }
    }, [currentRoom, user.id])

    /**
     * Obtiene todas las salas disponibles ordenadas por fecha de creación.
     */
    const fetchRooms = async () => {
        setError(null)
        try {
            const { data, error: fetchError } = await supabase
                .from('rooms')
                .select('*')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError
            if (data) setRooms(data)
        } catch (err) {
            setError('Error de conexión: No se pudieron cargar las salas.')
        }
    }

    /**
     * Asegura que el usuario tenga un perfil antes de realizar acciones en las salas.
     */
    const ensureProfileExists = async () => {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single()

        if (!profile) {
            // Create a basic profile if it doesn't exist
            const username = user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 5)}`
            const { error: createError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    username: username,
                    bio: '¡Hola! Soy nuevo aquí.'
                })

            if (createError) throw new Error('No se pudo inicializar tu perfil. Inténtalo de nuevo.')
        }
    }

    /**
     * Crea una nueva sala de chat, asegurando primero la existencia del perfil del usuario.
     */
    const createRoom = async () => {
        if (!newRoomName.trim()) return
        setLoading(true)
        setError(null)

        try {
            await ensureProfileExists()

            const { data, error: createError } = await supabase
                .from('rooms')
                .insert([{ name: newRoomName.trim(), created_by: user.id }])
                .select()

            if (createError) {
                if (createError.code === '23505' || createError.status === 409) {
                    throw new Error('Ese nombre de sala ya está en uso. ¡Prueba algo diferente!')
                }
                if (createError.code === '23503') {
                    throw new Error('Tu perfil no está sincronizado. Por favor, recarga la página.')
                }
                throw createError
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

    /**
     * Asocia al usuario con una sala específica.
     * 
     * @param {string} roomId - ID de la sala a la que unirse.
     */
    /**
     * Elimina una sala y todos sus registros asociados.
     * Solo permitido para el creador de la sala.
     * 
     * @param {string} roomId - ID de la sala a eliminar.
     */
    const deleteRoom = async (roomId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta sala? Esta acción no se puede deshacer.')) return

        setLoading(true)
        setError(null)
        try {
            const { error: deleteError } = await supabase
                .from('rooms')
                .delete()
                .eq('id', roomId)
                .eq('created_by', user.id)

            if (deleteError) throw deleteError

            if (currentRoom === roomId) {
                setCurrentRoom(null)
            }
            fetchRooms()
        } catch (err) {
            setError('No tienes permisos o hubo un error al eliminar la sala.')
        } finally {
            setLoading(false)
        }
    }

    const joinRoom = async (roomId) => {
        setLoading(true)
        setError(null)
        try {
            await ensureProfileExists()

            const { error: joinError } = await supabase
                .from('room_members')
                .upsert({ room_id: roomId, user_id: user.id })

            if (joinError) {
                if (joinError.code === '23505') {
                    // Ya es miembro, no es un error fatal
                } else if (joinError.code === '23503') {
                    throw new Error('Error de perfil: Recarga la página para sincronizar.')
                } else {
                    throw joinError
                }
            }

            setCurrentRoom(roomId)
            subscribeToMembers(roomId)
        } catch (err) {
            setError(err.message || 'Error inesperado al intentar unirse.')
        } finally {
            setLoading(false)
        }
    }

    const subscribeToMembers = (roomId) => {
        const fetchMembers = async () => {
            const { data } = await supabase
                .from('room_members')
                .select('user_id, profiles(username)')
                .eq('room_id', roomId)
            setMembers(data || [])
        }

        fetchMembers()

        const membersChannel = supabase
            .channel(`room:${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'room_members',
                filter: `room_id=eq.${roomId}`
            }, (payload) => {
                // SI ALGUIEN FUE ELIMINADO (LEAVE o KICK)
                if (payload.eventType === 'DELETE') {
                    // Si el usuario eliminado soy YO, me saca de la sala
                    if (payload.old.user_id === user.id) {
                        setCurrentRoom(null)
                        return
                    }
                }
                // Recargar lista para todos los demás cambios
                fetchMembers()
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${roomId}`
            }, () => {
                setCurrentRoom(null)
            })
            .subscribe()
    }

    /**
     * Permite al usuario actual salir de la sala de forma voluntaria.
     */
    const leaveRoom = async () => {
        if (!currentRoom) return
        try {
            await supabase
                .from('room_members')
                .delete()
                .eq('room_id', currentRoom)
                .eq('user_id', user.id)

            setCurrentRoom(null)
        } catch (err) {
            setCurrentRoom(null)
        }
    }

    /**
     * Permite al creador de la sala expulsar a otro usuario.
     */
    const kickUser = async (targetUserId) => {
        if (!currentRoom) return
        try {
            const { error: kickError } = await supabase
                .from('room_members')
                .delete()
                .eq('room_id', currentRoom)
                .eq('user_id', targetUserId)

            if (kickError) throw kickError
            // El listener de tiempo real se encargará de actualizar la lista para todos
        } catch (err) {
            setError('No se pudo expulsar al usuario.')
        }
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
                        className="room-detail-view"
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
                                            {(m.user_id === user.id ? 'Tú' : (m.profiles?.username?.[0] || 'U')).toUpperCase()}
                                        </div>
                                        <span>
                                            {m.user_id === user.id
                                                ? 'Tú (En línea)'
                                                : (m.profiles?.username || `Usuario ${m.user_id.slice(0, 8)}`)}
                                        </span>
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Mostrar botón de expulsar si soy el creador de la sala */}
                                            {rooms.find(r => r.id === currentRoom)?.created_by === user.id && m.user_id !== user.id && (
                                                <button
                                                    className="btn-kick"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (window.confirm(`¿Expulsar a ${m.profiles?.username || 'este usuario'}?`)) {
                                                            kickUser(m.user_id)
                                                        }
                                                    }}
                                                    title="Expulsar de la sala"
                                                >
                                                    <UserX size={16} />
                                                    <span style={{ fontSize: '10px', marginLeft: '4px' }}>Echar</span>
                                                </button>
                                            )}
                                            <div className="indicator-dot"></div>
                                        </div>
                                    </motion.li>
                                ))}
                            </ul>
                        </div>

                        <div className="room-actions">
                            <button className="primary outline" onClick={leaveRoom}>
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
                        className="room-list-view"
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
                                            <div className="room-actions-group" style={{ display: 'flex', gap: '8px' }}>
                                                {room.created_by === user.id && (
                                                    <button
                                                        className="btn-delete"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            deleteRoom(room.id)
                                                        }}
                                                        title="Eliminar Sala"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                                <button className="join-btn" onClick={() => joinRoom(room.id)}>
                                                    <LogIn size={16} />
                                                    <span>Unirse</span>
                                                </button>
                                            </div>
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
