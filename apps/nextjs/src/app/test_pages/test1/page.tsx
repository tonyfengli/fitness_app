"use client";

export default function TrainingDashboardWeb() {
  return (
    <div className="flex h-screen">
      <aside className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col">
        <div className="flex items-center mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <span className="material-icons text-white">fitness_center</span>
          </div>
          <h1 className="text-2xl font-bold ml-3">FitPro</h1>
        </div>
        <div className="relative mb-6">
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
          <input className="w-full bg-gray-100 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search clients" type="text"/>
        </div>
        <div className="flex space-x-4 mb-6">
          <button className="flex items-center justify-between w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm">
            Gender
            <span className="material-icons text-gray-500">arrow_drop_down</span>
          </button>
          <button className="flex items-center justify-between w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm">
            Age
            <span className="material-icons text-gray-500">arrow_drop_down</span>
          </button>
        </div>
        <h2 className="text-lg font-semibold mb-4">Clients</h2>
        <div className="flex-grow overflow-y-auto">
          <a className="flex items-center p-3 rounded-lg bg-indigo-100 mb-2" href="#">
            <img alt="Olivia Carter" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAYqnypMZMNYILjjR7zatfqmJlOs5mnVXXU9fH56vNEIjZpGx5w5Dl4qWrKQ2epgFuJnFEr3NFbHWisRm2uYuwX4TC9QvaNfL6g8Iox8CeU9zCKukLfGw9Bkwozi-e5tTiHz_uszfNC5ZYBIFvO-2iLGNCRmVP0fjxpMbhHLIVzgo2-Jy5pCkcvi-xGz4yqkKdHPK_qUUeDkOk0VFW-FqR3cnX0K_CCZk6Qimm5cM4vmj6Ir2SuqmLpdklnY5MTgHdMlY9Ex4qn_n_"/>
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Olivia Carter</p>
              <p className="text-sm text-gray-600">Strength Training</p>
            </div>
          </a>
          <a className="flex items-center p-3 rounded-lg hover:bg-gray-100 mb-2" href="#">
            <img alt="Ethan Walker" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdYvR-4ZiqM_n8pBe9cQCpRw9PDP6bkWQr-2pDbSYItcEm9S_bgCAUn8-aJjuH5oxIIjvqbXvEvjsgZxeYA5zwp_CMeiRhHC5GFEcVyxHf99krX8Q5tP5l8bqpN7Er2VpRJ2erTnnbeS-ooqhrEq0q06r5gYQcZGWcKf1Edml-P7xf7TPFqAfYcIFh0RrZj1yQXz9Q4Z17hFEVYRyLXQcUJvFztAFIma6sx3n73PHi74-DLuNdssMjfohYLypXX_ztTaEviDqojmuw"/>
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Ethan Walker</p>
              <p className="text-sm text-gray-600">Weight Loss</p>
            </div>
          </a>
          <a className="flex items-center p-3 rounded-lg hover:bg-gray-100 mb-2" href="#">
            <img alt="Ava Harper" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-mnXXib0shinH4ltZhLo6iNVEjwI7CwV2XPmdrCMqQ9534j6-BwCbDr_X7WD6stjVH1ZebOHE0XyvS4Z-84ZADO1emwxcouuAIahu24RXimKnek3ugTbtCjjCxpIRhEJ1IpCi2OyBB56uHtT-Z_MeLUTt0THfsU0uYc9e-9jCyM6qUt-C22e_p_ARluRdNv5NSES33fTrTeggZYeXY_59VzD6reFZkyPpUZM1CATsZqKoT56S_Dmv0lkb-sM53W-WWB3OCuK0GSWK"/>
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Ava Harper</p>
              <p className="text-sm text-gray-600">Cardio</p>
            </div>
          </a>
          <a className="flex items-center p-3 rounded-lg hover:bg-gray-100 mb-2" href="#">
            <img alt="Liam Foster" className="w-10 h-10 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnBHpJbXOFtHjKJSCFoZnA4wfUIom-MR6NBn_G2r_m1PmA3t9GmeWbEUG0vq-TKRBlQzeUvgoB8G5pTJSMvrT-jwHVb2U694mhnb0r_n4bAbcUeFYkBIslwF5PipNEps2PAajY-RT85nasvRrFRXWmJrhp8GXMeCyofq6nLQ8Yx_85SX9JjkqU16oOJ3lvbXw8SlYxvzqtTdIBZXIf4SkOfX67ZwdGRJNPYwgxqWN5FwTxCII7LZHjB2NZVPB03ldv2w_7SCWgozS1"/>
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Liam Foster</p>
              <p className="text-sm text-gray-600">Strength Training</p>
            </div>
          </a>
        </div>
        <div className="mt-auto">
          <button className="flex items-center justify-center w-full bg-indigo-600 text-white rounded-lg py-2">
            <span className="material-icons mr-2">add</span>
            Add New Client
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Olivia Carter</h1>
            <p className="text-gray-500 mt-1">Strength Training</p>
          </div>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 rounded-full hover:bg-gray-200">
              <span className="material-icons text-gray-600">notifications</span>
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500"></span>
            </button>
          </div>
        </header>
        <div className="space-y-12">
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Workout Program - 2024-07-20</h3>
              <button className="flex items-center bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50">
                <span className="material-icons mr-2 text-base">edit</span>
                Edit Workout
              </button>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="bg-gray-100 p-3 rounded-full mr-4">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Squats</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="bg-gray-100 p-3 rounded-full mr-4">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Bench Press</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="bg-gray-100 p-3 rounded-full mr-4">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Deadlifts</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 bg-white rounded-lg shadow-sm">
              <button className="w-full flex justify-between items-center p-4 text-left">
                <span className="font-medium text-gray-700">View Client Feedback</span>
                <span className="material-icons text-gray-500">expand_less</span>
              </button>
              <div className="p-4 border-t border-gray-200 space-y-4">
                <p className="text-gray-500 text-sm">"Feeling stronger this week, but the deadlifts felt a bit heavy on the last set."</p>
                <button className="flex items-center bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-200">
                  <span className="material-icons mr-2 text-base">add_comment</span>
                  Add Note
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
            </div>
          </section>
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Workout Program - 2024-07-22</h3>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="bg-gray-100 p-3 rounded-full mr-4">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Pull-ups</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="bg-gray-100 p-3 rounded-full mr-4">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Overhead Press</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="bg-gray-100 p-3 rounded-full mr-4">
                    <span className="material-icons text-gray-600">fitness_center</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Barbell Rows</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 bg-white rounded-lg shadow-sm">
              <button className="w-full flex justify-between items-center p-4 text-left">
                <span className="font-medium text-gray-700">View Client Feedback</span>
                <span className="material-icons text-gray-500">expand_less</span>
              </button>
              <div className="p-4 border-t border-gray-200 space-y-4">
                <p className="text-gray-500 text-sm">"No feedback yet."</p>
                <button className="flex items-center bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-200">
                  <span className="material-icons mr-2 text-base">add_comment</span>
                  Add Note
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}