import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MessageCircle, Phone, Mail } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('other');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response: any) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  }, []);

  const generateSearchId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!confirmationResult) {
        // Step 1: Send SMS
        const appVerifier = window.recaptchaVerifier;
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setConfirmationResult(confirmation);
      } else {
        // Step 2: Verify Code
        const result = await confirmationResult.confirm(verificationCode);
        const user = result.user;
        
        // Check if user exists, if not create profile
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          const searchId = generateSearchId();
          await setDoc(docRef, {
            uid: user.uid,
            email: user.email || '',
            phoneNumber: user.phoneNumber,
            firstName: firstName || 'Utilisateur',
            lastName: lastName || '',
            gender,
            searchId,
            createdAt: new Date().toISOString(),
            theme: 'dark'
          });
        }
      }
    } catch (err: any) {
      console.error("Phone Auth error:", err);
      setError('Erreur lors de l\'authentification par téléphone. Vérifiez le numéro ou le code.');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((widgetId: any) => {
          window.grecaptcha.reset(widgetId);
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const searchId = generateSearchId();
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          firstName,
          lastName,
          gender,
          searchId,
          createdAt: new Date().toISOString(),
          theme: 'dark'
        });

        await sendEmailVerification(user);
        setVerificationSent(true);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/too-many-requests' || err.code === 'auth/network-request-failed') {
        setError('Veuillez attendre un moment et réessayer.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Email ou mot de passe incorrect.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Cette adresse e-mail est déjà utilisée.');
      } else {
        setError('Une erreur est survenue. Veuillez attendre un moment et réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <MessageCircle className="mx-auto h-16 w-16 text-white" />
          <h2 className="text-3xl font-bold">Vérifiez votre e-mail</h2>
          <p className="text-gray-400">
            Un lien de vérification a été envoyé à {email}. Veuillez cliquer sur le lien pour valider votre compte.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-white text-black hover:bg-gray-200 rounded-full font-semibold transition-colors"
          >
            J'ai vérifié mon e-mail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <MessageCircle className="mx-auto h-16 w-16 text-white" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight">
            Chatfriend
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {isLogin ? 'Connectez-vous pour discuter' : 'Créez un compte pour commencer'}
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => { setAuthMethod('email'); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${authMethod === 'email' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
          >
            <Mail className="w-4 h-4" /> E-mail
          </button>
          <button
            onClick={() => { setAuthMethod('phone'); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${authMethod === 'phone' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
          >
            <Phone className="w-4 h-4" /> Téléphone
          </button>
        </div>

        <form className="space-y-6" onSubmit={authMethod === 'email' ? handleEmailSubmit : handlePhoneSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                      placeholder="Nom"
                    />
                  </div>
                </div>
                <div>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-white"
                  >
                    <option value="male">Homme</option>
                    <option value="female">Femme</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
              </>
            )}
            
            {authMethod === 'email' ? (
              <>
                <div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                    placeholder="Adresse e-mail"
                  />
                </div>
                
                <div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                    placeholder="Mot de passe"
                  />
                </div>
              </>
            ) : (
              <>
                {!confirmationResult ? (
                  <div>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                      placeholder="Numéro de téléphone (ex: +33612345678)"
                    />
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-center tracking-widest text-lg"
                      placeholder="Code à 6 chiffres"
                      maxLength={6}
                    />
                  </div>
                )}
                <div id="recaptcha-container"></div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-white text-black hover:bg-gray-200 disabled:opacity-50 rounded-full font-semibold transition-colors"
          >
            {loading ? 'Chargement...' : (
              authMethod === 'phone' && confirmationResult ? 'Vérifier le code' :
              isLogin ? 'Se connecter' : "S'inscrire"
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-gray-300 hover:text-white text-sm font-medium"
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
