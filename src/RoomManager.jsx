import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function RoomManager({ user }) {
    const [rooms, setRooms] = useState([])
    const [newRoomName, setNewRoomName] = useState('')
    const [currentRoom, setCurrentRoom] = useState(null)
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchRooms()

        // Subscribe to new rooms
        const subscription = supabase
            .channel('public:rooms')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, payload => {
                setRooms(prev => [payload.new, ...prev])
            })
            .subscribe()

        return () => subscription.unsubscribe()
    }, [])

    const fetchRooms = async () => {
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: false })

        if (data) setRooms(data)
    }

    const createRoom = async () => {
        if (!newRoomName) return
        setLoading(true)
        const { data, error } = await supabase
            .from('rooms')
            .insert([{ name: newRoomName, created_by: user.id }])
            .select()

        if (error) {
            console.error('Error creating room:', error)
        } else {
            setNewRoomName('')
            joinRoom(data[0].id)
        }
        setLoading(false)
    }

    const joinRoom = async (roomId) => {
        const { error } = await supabase
            .from('room_members')
            .upsert({ room_id: roomId, user_id: user.id })

        if (!error) {
            setCurrentRoom(roomId)
            subscribeToMembers(roomId)
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
                // Refresh members
                supabase
                    .from('room_members')
                    .select('user_id')
                    .eq('room_id', roomId)
                    .then(({ data }) => setMembers(data || []))
            })
            .subscribe()
    }

    if (currentRoom) {
        return (
            <div className="card room-detail">
                <h3>Sala: {rooms.find(r => r.id === currentRoom)?.name}</h3>
                <p>Integrantes online: {members.length}</p>
                <ul className="member-list">
                    {members.map(m => (
                        <li key={m.user_id}>{m.user_id === user.id ? 'Tú (Online)' : `Usuario: ${m.user_id.slice(0, 8)}...`}</li>
                    ))}
                </ul>
                <button className="primary" onClick={() => setCurrentRoom(null)}>Salir de Sala</button>
            </div>
        )
    }

    return (
        <div className="card room-manager">
            <h3>Salas Disponibles</h3>
            <div className="create-room">
                <input
                    type="text"
                    placeholder="Nombre de la sala"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                />
                <button className="primary" onClick={createRoom} disabled={loading}>
                    {loading ? '...' : 'Crear'}
                </button>
            </div>

            <div className="room-list">
                {rooms.length === 0 ? <p>No hay salas. ¡Crea una!</p> : (
                    rooms.map(room => (
                        <div key={room.id} className="room-item">
                            <span>{room.name}</span>
                            <button className="link-button" onClick={() => joinRoom(room.id)}>Unirse</button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
