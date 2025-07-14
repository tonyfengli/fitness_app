"use client";

export default function OverviewWeb() {
  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center space-x-3">
            <span className="material-icons text-4xl text-gray-800">fitness_center</span>
            <span className="text-3xl font-bold text-gray-900">FitTrack</span>
          </div>
          <nav className="hidden md:flex items-center space-x-10">
            <a className="text-gray-600 hover:text-gray-900 transition-colors" href="#">Dashboard</a>
            <a className="text-gray-900 font-semibold border-b-2 border-gray-800 pb-1" href="#">Workouts</a>
            <a className="text-gray-600 hover:text-gray-900 transition-colors" href="#">Progress</a>
            <a className="text-gray-600 hover:text-gray-900 transition-colors" href="#">Community</a>
          </nav>
          <div className="flex items-center space-x-5">
            <button className="relative text-gray-600 hover:text-gray-900 transition-colors">
              <span className="material-icons text-3xl">notifications</span>
              <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-gray-50"></span>
            </button>
            <img alt="User avatar" className="w-12 h-12 rounded-full border-2 border-gray-200" src="https://lh3.googleusercontent.com/a/ACg8ocK_1Y4y3-2-2z4T3u9A4nF8E6EwFwOD_Fp_QfKzH8xG=s96-c"/>
          </div>
        </header>
        <main>
          <h1 className="text-5xl font-bold mb-12 text-gray-900">Workout Overview</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <img alt="Player 1 avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDeQie9K8aFdrJas2b7mft2OAAl5OLFlsu3elsZZNaNcF3We8OMVOnAgnHZBtruOwzz3uUTV0R3XPHgcuKvZq8Z1LwJSFnsHxY0PRaolzsPtN9qFB-_CxoSYsGZNJS735pqQ1-yL0gv2YUZKuFkH1xP1s8XQgv67IePJcA0UNjY1oFvvrPjEAN5-ww24GcdoLrnvni5cGtcIslwXWwUFQiVyTxvnLDpvCfYy4vdkTayq6Xf237_2Kf0Ik9mfOCZnwDacgJJdrn1btw"/>
                  <h2 className="text-xl font-bold text-gray-900">Alex</h2>
                </div>
                <span className="material-icons text-gray-400 text-3xl">qr_code_2</span>
              </div>
              <div className="space-y-5">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">fitness_center</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Bench Press</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">8</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_gymnastics</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Squats</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">4</span> sets, <span className="font-bold text-gray-800">10</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">self_improvement</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Deadlifts</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">5</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_mma</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Overhead Press</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">8</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_handball</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Barbell Rows</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">4</span> sets, <span className="font-bold text-gray-800">10</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">accessibility_new</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Crunches</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">20</span> reps</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <img alt="Player 2 avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChrOSAj5TQXJftiP6hZaGZw9Uf1AB-LSvEB8O5LuhOH8kU_CuH35Awe5RA7v7byP4rShKeD9ciG6cuX70PZNQF1ZHQoscISfSQEOB3E9owDKU9q6r4IJnsd7S3AmpT4S7iKJGdufDekuNUmEnWX4tEjn6qgMSUZ-jZacGMFIxREQsMFBUh6AgI01-HGb-oEl8avdz5CxiLdAc7Oi4cDBMPmIxCFRYEteldlYiWDYii4XPJOQVxPoSAZN-1mbUz3AcXHqCBkyKeZGM"/>
                  <h2 className="text-xl font-bold text-gray-900">Jordan</h2>
                </div>
                <span className="material-icons text-gray-400 text-3xl">qr_code_2</span>
              </div>
              <div className="space-y-5">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">directions_run</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Running</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">5</span> km, <span className="font-bold text-gray-800">25</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_mma</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Pull-ups</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">5</span> sets, <span className="font-bold text-gray-800">12</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">spa</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Stretching</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">1</span> set, <span className="font-bold text-gray-800">10</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">fitness_center</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Push-ups</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">4</span> sets, <span className="font-bold text-gray-800">15</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_gymnastics</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Lunges</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">12</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">accessibility_new</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Glute Bridges</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">15</span> reps</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <img alt="Player 3 avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKBr6sNuLHl4l9_buHE0p0KMkcw5A0StWVvdh9wwsOf1IT72dNNBfHxuE0Km4W6d046msxP06L2B3hLfHIYo1vWDlzT9SiWk3YCix47FnIwEfw6utyyVtPaLX3PcZKa2cMrawj6TmD_fg5q_WdcvCuaXIzwkslYrplhwdL0jAIJExbUOobiMjxp8flmqM4gtcfFdNkWlxWqNHLaWNVP5vFRKOXSkjCkE25r8oTzOL6R500EvcpYEexrzN4UCXi_TXbPf-A1nzPDBg"/>
                  <h2 className="text-xl font-bold text-gray-900">Sam</h2>
                </div>
                <span className="material-icons text-gray-400 text-3xl">qr_code_2</span>
              </div>
              <div className="space-y-5">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">pool</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Swimming</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">1</span> km, <span className="font-bold text-gray-800">45</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_handball</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Bicep Curls</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">15</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">accessibility_new</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Plank</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">60</span> sec</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">fitness_center</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Tricep Dips</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">12</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_gymnastics</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Russian Twists</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">20</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">self_improvement</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Foam Rolling</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">1</span> set, <span className="font-bold text-gray-800">5</span> min</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <img alt="Player 4 avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWLU9SXPjAkEOkVa6-WUyEW-6QZZ3xkdjxvgyr0tFB-S2g2cn4iQQcph5G-gP-gKc5fpJ9BS0Cpi7wNr7Nv_Ax9__agHU5kxQuGee1xiKhv_IjZJ91U-5n-bAtgZpjQCr_mj3qcf_kKOAQKsHAqWWOmDQIRzhRxBuxzHv332avW0q4Wnh4LFQ8xZ9Ur83G-JzNbrWQUE3Gt1PVoWu45A7QD0AWQFHiAUQTRjizb-KLabUry01hriDcnj6hMuo5PXOfu3763SynWbo"/>
                  <h2 className="text-xl font-bold text-gray-900">Casey</h2>
                </div>
                <span className="material-icons text-gray-400 text-3xl">qr_code_2</span>
              </div>
              <div className="space-y-5">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">directions_bike</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Cycling</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">10</span> km, <span className="font-bold text-gray-800">30</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">fitness_center</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Leg Press</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">4</span> sets, <span className="font-bold text-gray-800">12</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">self_improvement</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Yoga</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">1</span> session, <span className="font-bold text-gray-800">20</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_gymnastics</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Hamstring Curls</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">15</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">fitness_center</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Dumbbell Flys</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">12</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">accessibility_new</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Side Plank</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">30</span> sec</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <img alt="Player 5 avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAC6uHeRu5ItKrhuQzm1mbC35Uyla_Q41SibqtVfyNwdWM8y2Y5ugwR2V0TpURMGrI1DLUryMVhrRPaL3BH4vKD-hjnIBrm3Fc6G5cl8s6XzitWoJMs3Hm1owGwWxibf5TxtjqbpWJ8a6m3PXEgeG24kPcalKCKwpsTR_DXWEEIw1ukyU3PZFsoQZdW4E0MR8dy2-B1J6dkWOLmNU2sQPhzaEUdZH0CSyWfWL4hy2dYo2U6j2dDVERfsHqMrdAVoDUH9kP6CTYWOjI"/>
                  <h2 className="text-xl font-bold text-gray-900">Riley</h2>
                </div>
                <span className="material-icons text-gray-400 text-3xl">qr_code_2</span>
              </div>
              <div className="space-y-5">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_kabaddi</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Boxing</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">5</span> rounds, <span className="font-bold text-gray-800">3</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">skateboarding</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Jump Rope</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">10</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">downhill_skiing</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Calf Raises</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">4</span> sets, <span className="font-bold text-gray-800">20</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">fitness_center</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Kettlebell Swings</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">4</span> sets, <span className="font-bold text-gray-800">15</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_mma</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Battle Ropes</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">5</span> sets, <span className="font-bold text-gray-800">30</span> sec</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">self_improvement</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Meditation</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">1</span> session, <span className="font-bold text-gray-800">10</span> min</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <img alt="Player 6 avatar" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/a/ACg8ocL8Fp-2X-4X-4X-4X-4X-4X-4X-4X-4X-4X-4X-4X=s96-c"/>
                  <h2 className="text-xl font-bold text-gray-900">Jamie</h2>
                </div>
                <span className="material-icons text-gray-400 text-3xl">qr_code_2</span>
              </div>
              <div className="space-y-5">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">fitness_center</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Glute Kickbacks</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">15</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_handball</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Shoulder Press</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">12</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">rowing</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Rowing Machine</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">2000</span> m, <span className="font-bold text-gray-800">10</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">sports_gymnastics</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Burpees</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">5</span> sets, <span className="font-bold text-gray-800">10</span> reps</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">self_improvement</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Deep Breathing</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">5</span> min</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 p-3 rounded-full"><span className="material-icons text-gray-500">accessibility_new</span></div>
                  <div>
                    <p className="font-semibold text-gray-800">Leg Raises</p>
                    <p className="text-sm text-gray-500"><span className="font-bold text-gray-800">3</span> sets, <span className="font-bold text-gray-800">15</span> reps</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}