import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'
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
                setMessage('¡Cuenta creada! Revisa tu email para el enlace de confirmación.')
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
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card auth-card"
        >
            <div className="auth-header">
                <h2>{isSignUp ? 'Crear Cuenta' : 'Bienvenido de nuevo'}</h2>
                <p>{isSignUp ? 'Únete a la comunidad Matcher' : 'Ingresa tus credenciales para continuar'}</p>
            </div>

            <form onSubmit={handleAuth}>
                <div className="form-group">
                    <label>
                        <Mail size={14} style={{ marginRight: '6px' }} />
                        Email
                    </label>
                    <input
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>
                        <Lock size={14} style={{ marginRight: '6px' }} />
                        Contraseña
                    </label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="error-message"
                        >
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </motion.div>
                    )}
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="success-message"
                        >
                            <CheckCircle2 size={16} />
                            <span>{message}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    className="primary"
                    type="submit"
                >
                    {loading ? (
                        <span className="loading-spinner">...</span>
                    ) : (
                        <div className="btn-content">
                            {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
                            <span>{isSignUp ? 'Registrarse ahora' : 'Iniciar Sesión'}</span>
                        </div>
                    )}
                </motion.button>
            </form>

            <div className="auth-footer">
                <p>
                    {isSignUp ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}
                    <button onClick={() => setIsSignUp(!isSignUp)} className="link-button">
                        {isSignUp ? 'Inicia Sesión' : 'Regístrate aquí'}
                    </button>
                </p>
            </div>
        </motion.div>
    )
}
