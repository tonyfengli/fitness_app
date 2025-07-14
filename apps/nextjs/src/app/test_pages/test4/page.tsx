"use client";

export default function FitProMobile() {
  return (
    <div className="bg-white min-h-screen">
      <div className="px-4 py-3">
        <header className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <span className="material-icons text-blue-600 mr-2">fitness_center</span>
            <h1 className="text-xl font-bold text-gray-800">FitPro</h1>
          </div>
          <button className="relative">
            <span className="material-icons text-gray-600">notifications</span>
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>
        </header>
        <main>
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <div className="flex items-center">
              <img alt="Profile picture of Olivia Carter" className="w-12 h-12 rounded-full mr-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIeLmYWb8tK-gWfoQYAw7zpYbgwOaL-OGsdGtWkQBk4FVgbbUQex4_BQpvdxAFU5xokk29v881Ypk2wLBiLx-0QY09DZdSCvNqkW0CVGdw8sc9citoSEW2KJBpJEsgs0bG8IIDDcbn7dXk7DZZHAtq-NGvFSqscNAi3TtQUCXYhuuR3kRLD92fDCVwyxcXIxyoZPifxTGlZQFEGO92YZYWtxF_anZ0zF5OmpZjvC-rmW0mV7lVFsA7-O_J5PiK_UxqpvpJUaHuZvEt"/>
              <div>
                <h2 className="font-semibold text-lg text-gray-900">Olivia Carter</h2>
                <p className="text-gray-600 text-sm">Strength Training</p>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Workout Program - 2024-07-20</h3>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                  <span className="material-icons text-base mr-1">edit</span>
                  Edit
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-200 rounded-full mr-3">
                      <span className="material-icons text-gray-600">fitness_center</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Squats</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">play_circle_outline</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-200 rounded-full mr-3">
                      <span className="material-icons text-gray-600">fitness_center</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Bench Press</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">play_circle_outline</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-200 rounded-full mr-3">
                      <span className="material-icons text-gray-600">fitness_center</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Deadlifts</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">play_circle_outline</span>
                    </button>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 flex items-center justify-center py-2 px-4 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
              <div className="pt-4 mt-6">
                <button className="w-full flex justify-between items-center text-left">
                  <span className="font-medium text-gray-700">View Client Feedback</span>
                  <span className="material-icons text-gray-500">expand_less</span>
                </button>
                <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                  Client feedback will be displayed here.
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 my-6"></div>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Workout Program - 2024-07-22</h3>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                  <span className="material-icons text-base mr-1">edit</span>
                  Edit
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-200 rounded-full mr-3">
                      <span className="material-icons text-gray-600">fitness_center</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Pull-ups</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">play_circle_outline</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-200 rounded-full mr-3">
                      <span className="material-icons text-gray-600">fitness_center</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Overhead Press</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">play_circle_outline</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-200 rounded-full mr-3">
                      <span className="material-icons text-gray-600">fitness_center</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Barbell Rows</p>
                      <p className="text-sm text-gray-500">3 sets</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">play_circle_outline</span>
                    </button>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 flex items-center justify-center py-2 px-4 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
              <div className="pt-4 mt-6">
                <button className="w-full flex justify-between items-center text-left">
                  <span className="font-medium text-gray-700">View Client Feedback</span>
                  <span className="material-icons text-gray-500">expand_less</span>
                </button>
                <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                  Client feedback will be displayed here.
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}