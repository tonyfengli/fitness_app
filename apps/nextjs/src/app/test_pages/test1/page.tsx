"use client";

export default function TrainingDashboardWeb() {
  return (
    <div className="flex h-screen">
      <aside className="flex w-80 flex-col border-r border-gray-200 bg-white p-6">
        <div className="mb-8 flex items-center">
          <div className="rounded-lg bg-indigo-600 p-2">
            <span className="material-icons text-white">fitness_center</span>
          </div>
          <h1 className="ml-3 text-2xl font-bold">FitPro</h1>
        </div>
        <div className="relative mb-6">
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            search
          </span>
          <input
            className="w-full rounded-lg bg-gray-100 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search clients"
            type="text"
          />
        </div>
        <div className="mb-6 flex space-x-4">
          <button className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            Gender
            <span className="material-icons text-gray-500">
              arrow_drop_down
            </span>
          </button>
          <button className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            Age
            <span className="material-icons text-gray-500">
              arrow_drop_down
            </span>
          </button>
        </div>
        <h2 className="mb-4 text-lg font-semibold">Clients</h2>
        <div className="flex-grow overflow-y-auto">
          <a
            className="mb-2 flex items-center rounded-lg bg-indigo-100 p-3"
            href="#"
          >
            <img
              alt="Olivia Carter"
              className="h-10 w-10 rounded-full"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAYqnypMZMNYILjjR7zatfqmJlOs5mnVXXU9fH56vNEIjZpGx5w5Dl4qWrKQ2epgFuJnFEr3NFbHWisRm2uYuwX4TC9QvaNfL6g8Iox8CeU9zCKukLfGw9Bkwozi-e5tTiHz_uszfNC5ZYBIFvO-2iLGNCRmVP0fjxpMbhHLIVzgo2-Jy5pCkcvi-xGz4yqkKdHPK_qUUeDkOk0VFW-FqR3cnX0K_CCZk6Qimm5cM4vmj6Ir2SuqmLpdklnY5MTgHdMlY9Ex4qn_n_"
            />
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Olivia Carter</p>
              <p className="text-sm text-gray-600">Strength Training</p>
            </div>
          </a>
          <a
            className="mb-2 flex items-center rounded-lg p-3 hover:bg-gray-100"
            href="#"
          >
            <img
              alt="Ethan Walker"
              className="h-10 w-10 rounded-full"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdYvR-4ZiqM_n8pBe9cQCpRw9PDP6bkWQr-2pDbSYItcEm9S_bgCAUn8-aJjuH5oxIIjvqbXvEvjsgZxeYA5zwp_CMeiRhHC5GFEcVyxHf99krX8Q5tP5l8bqpN7Er2VpRJ2erTnnbeS-ooqhrEq0q06r5gYQcZGWcKf1Edml-P7xf7TPFqAfYcIFh0RrZj1yQXz9Q4Z17hFEVYRyLXQcUJvFztAFIma6sx3n73PHi74-DLuNdssMjfohYLypXX_ztTaEviDqojmuw"
            />
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Ethan Walker</p>
              <p className="text-sm text-gray-600">Weight Loss</p>
            </div>
          </a>
          <a
            className="mb-2 flex items-center rounded-lg p-3 hover:bg-gray-100"
            href="#"
          >
            <img
              alt="Ava Harper"
              className="h-10 w-10 rounded-full"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-mnXXib0shinH4ltZhLo6iNVEjwI7CwV2XPmdrCMqQ9534j6-BwCbDr_X7WD6stjVH1ZebOHE0XyvS4Z-84ZADO1emwxcouuAIahu24RXimKnek3ugTbtCjjCxpIRhEJ1IpCi2OyBB56uHtT-Z_MeLUTt0THfsU0uYc9e-9jCyM6qUt-C22e_p_ARluRdNv5NSES33fTrTeggZYeXY_59VzD6reFZkyPpUZM1CATsZqKoT56S_Dmv0lkb-sM53W-WWB3OCuK0GSWK"
            />
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Ava Harper</p>
              <p className="text-sm text-gray-600">Cardio</p>
            </div>
          </a>
          <a
            className="mb-2 flex items-center rounded-lg p-3 hover:bg-gray-100"
            href="#"
          >
            <img
              alt="Liam Foster"
              className="h-10 w-10 rounded-full"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnBHpJbXOFtHjKJSCFoZnA4wfUIom-MR6NBn_G2r_m1PmA3t9GmeWbEUG0vq-TKRBlQzeUvgoB8G5pTJSMvrT-jwHVb2U694mhnb0r_n4bAbcUeFYkBIslwF5PipNEps2PAajY-RT85nasvRrFRXWmJrhp8GXMeCyofq6nLQ8Yx_85SX9JjkqU16oOJ3lvbXw8SlYxvzqtTdIBZXIf4SkOfX67ZwdGRJNPYwgxqWN5FwTxCII7LZHjB2NZVPB03ldv2w_7SCWgozS1"
            />
            <div className="ml-4">
              <p className="font-semibold text-gray-900">Liam Foster</p>
              <p className="text-sm text-gray-600">Strength Training</p>
            </div>
          </a>
        </div>
        <div className="mt-auto">
          <button className="flex w-full items-center justify-center rounded-lg bg-indigo-600 py-2 text-white">
            <span className="material-icons mr-2">add</span>
            Add New Client
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Olivia Carter</h1>
            <p className="mt-1 text-gray-500">Strength Training</p>
          </div>
          <div className="flex items-center space-x-4">
            <button className="relative rounded-full p-2 hover:bg-gray-200">
              <span className="material-icons text-gray-600">
                notifications
              </span>
              <span className="absolute right-1 top-1 block h-2 w-2 rounded-full bg-red-500"></span>
            </button>
          </div>
        </header>
        <div className="space-y-12">
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Workout Program - 2024-07-20
              </h3>
              <button className="flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <span className="material-icons mr-2 text-base">edit</span>
                Edit Workout
              </button>
            </div>
            <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 py-2">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-gray-100 p-3">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Squats</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 py-2">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-gray-100 p-3">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Bench Press</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-gray-100 p-3">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Deadlifts</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-white shadow-sm">
              <button className="flex w-full items-center justify-between p-4 text-left">
                <span className="font-medium text-gray-700">
                  View Client Feedback
                </span>
                <span className="material-icons text-gray-500">
                  expand_less
                </span>
              </button>
              <div className="space-y-4 border-t border-gray-200 p-4">
                <p className="text-sm text-gray-500">
                  "Feeling stronger this week, but the deadlifts felt a bit
                  heavy on the last set."
                </p>
                <button className="flex items-center rounded-lg bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200">
                  <span className="material-icons mr-2 text-base">
                    add_comment
                  </span>
                  Add Note
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="flex items-center rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
            </div>
          </section>
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Workout Program - 2024-07-22
              </h3>
            </div>
            <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 py-2">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-gray-100 p-3">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Pull-ups</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 py-2">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-gray-100 p-3">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      Overhead Press
                    </p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="mr-4 rounded-full bg-gray-100 p-3">
                    <span className="material-icons text-gray-600">
                      fitness_center
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Barbell Rows</p>
                    <p className="text-sm text-gray-500">3 sets</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-white shadow-sm">
              <button className="flex w-full items-center justify-between p-4 text-left">
                <span className="font-medium text-gray-700">
                  View Client Feedback
                </span>
                <span className="material-icons text-gray-500">
                  expand_less
                </span>
              </button>
              <div className="space-y-4 border-t border-gray-200 p-4">
                <p className="text-sm text-gray-500">"No feedback yet."</p>
                <button className="flex items-center rounded-lg bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200">
                  <span className="material-icons mr-2 text-base">
                    add_comment
                  </span>
                  Add Note
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="flex items-center rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
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
