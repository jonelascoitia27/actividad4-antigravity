import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [error, setError] = useState(null)
    const [message, setMessage] = useState(null)

    const handleAuth = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (error) throw error
                setMessage('Revisa tu email para el enlace de confirmación (si está habilitado en Supabase)')
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
            }
        } catch (error) {
            setError(error.error_description || error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card auth-card">
            <h2>{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
            <form onSubmit={handleAuth}>
                <div className="form-group">
                    <label>Email</label>
                    <input
                        type="email"
                        placeholder="Introduce tu email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Contraseña</label>
                    <input
                        type="password"
                        placeholder="Introduce tu contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                {error && <div className="error-message">{error}</div>}
                {message && <div className="success-message">{message}</div>}

                <button disabled={loading} className="primary" type="submit">
                    {loading ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Entrar'}
                </button>
            </form>

            <p className="auth-toggle">
                {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                <button onClick={() => setIsSignUp(!isSignUp)} className="link-button">
                    {isSignUp ? 'Inicia Sesión' : 'Regístrate'}
                </button>
            </p>
        </div>
    )
}
