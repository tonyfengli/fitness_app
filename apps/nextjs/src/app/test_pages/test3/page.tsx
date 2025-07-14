"use client";

export default function GameLobbyWeb() {
  return (
    <div className="bg-white font-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-3">
            <span className="material-icons text-blue-500 text-3xl">sports_esports</span>
            <h1 className="text-xl font-bold text-gray-800">Game Lobby</h1>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a className="text-gray-600 hover:text-gray-900" href="#">Home</a>
            <a className="text-gray-600 hover:text-gray-900" href="#">Games</a>
            <a className="text-gray-600 hover:text-gray-900" href="#">Profile</a>
          </nav>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 rounded-full hover:bg-gray-100">
              <span className="material-icons text-gray-600">notifications</span>
            </button>
            <img alt="User avatar" className="h-10 w-10 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuARjRkA0qfcebcp6YPxBqQUtxbWRkdfFFSOXt1QCIupbLoFTX_qUzxxj4IHaL91s_aWIvkw7U8jvzl7IcFmpIQbTCE25HSdhsG4wG81y6_Sxlajrxxi03yTz46fTcZ1Y_hYCh02DveDEPuenpIO9Vu_lo7LXLO8S3GYyaR0UMRaDA78y_cqAx5gmUQkDlxBPpMCfuYufzcrAf5HRhNJdSK8Stx0NwsRWOgNzrFlyM5r1ou3WZtWe8pTfHdbc1uUlMLtht0O-fas07St"/>
          </div>
        </header>
        <main className="mt-16">
          <div className="text-center">
            <button className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-3 px-8 rounded-full shadow-md transition duration-300">
              Play
            </button>
          </div>
          <div className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Players in Game</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img alt="Sophia Clark's avatar" className="h-14 w-14 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB50CK5qXIG5VUHos8_DsESC_M5Gq08Jw9aL0uLuJ7XSUHRBDu_uDxEsOvN_ELiiHG24bhF1PbrKZQXsRV1yFRl9Nq5pSw2d-2BEFgFlrGufzh6qOYqrjxHO9Nv-QHheSEGOL2LNZKapsfSbSnCAIEZPFpR8_F6RRc3bUjTixQEshhylmjpczBvPB3wtFLiK0-NafiUjSYszoHGlEzjeHiyMRf0WwIqenCHzjH-nQkKB3RXMzjRwKWvPx0ORBoC-RIhr8PdRliLenKJ"/>
                  <div>
                    <p className="text-lg font-semibold text-gray-800">Sophia Clark</p>
                    <p className="text-sm text-green-500">Online</p>
                    <p className="text-sm text-gray-500">Level 5 | Idle in the main lobby, waiting for friends to join the party.</p>
                  </div>
                </div>
                <button className="p-2 rounded-full hover:bg-gray-200">
                  <span className="material-icons text-gray-500">edit</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img alt="Ethan Bennett's avatar" className="h-14 w-14 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkeEgjOiZGd5n1Q6htN-jeFdkCX8BGhq37BoKJH6fEnx23UFPyTDvBoCsAtYD-OI8ukJoQIzaWFOTCx-oGBz1-Y3rdOOJc3zkHZ_PXtYimuHom3YKzOwd2yYwqZ_53rvO9EHm61YtmBFruVkymZWfnXyr6iwr2lXq65IycCIBqKaePs1pb8JwBdEOlSf192O46gHoBICew4vm-RFjfhgkpUfL-tYjjLlj_GUb3AP_93Tr_scZQfFFvNktZUI0k9CgsQ2OZ3LGNXobw"/>
                  <div>
                    <p className="text-lg font-semibold text-gray-800">Ethan Bennett</p>
                    <p className="text-sm text-red-500">In Match</p>
                    <p className="text-sm text-gray-500">Level 10 | Current Game: Conquest. Dominating the battlefield.</p>
                  </div>
                </div>
                <button className="p-2 rounded-full hover:bg-gray-200">
                  <span className="material-icons text-gray-500">edit</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img alt="Olivia Harper's avatar" className="h-14 w-14 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgpvOP2LPq9LiJT8EKMili5LzRBQp0L6mZPk0c37gdeeVtpnQ1G1u3jqRUjWaH3ghuNmwtwcM1gCyTy7Y3EOkHVead4CTiZgProQt0JeFnS447EaYoQamGZSd168_Ch8BASFuJSz0q3NeoPWC97jhihVtsZaPYL4xGvkdbZcePsJc0EO8e7H_7El_udubSSs5na2kuObSsFen3J8HU4wvKpH2fAl9gj-18f8-2EdLBWwG-4_qe3Dlu8N43FH_kNsvdSVsiglYtRMK7"/>
                  <div>
                    <p className="text-lg font-semibold text-gray-800">Olivia Harper</p>
                    <p className="text-sm text-green-500">Online</p>
                    <p className="text-sm text-gray-500">Level 8 | Idle, checking out the latest item shop cosmetics.</p>
                  </div>
                </div>
                <button className="p-2 rounded-full hover:bg-gray-200">
                  <span className="material-icons text-gray-500">edit</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img alt="Liam Foster's avatar" className="h-14 w-14 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbY-EERgSCd4qowkT9uEVQrvEY13aXRTNspxqNwmMwGB-9ek3_SKuOSGD6wtKUrdUhAsj75X2qvnGubzz5wpQjgAsD2kyFTL4fRRXTmgARARqv_h16jSVdzH9Ytgz8a-DvpXQCVRElyVz0zd1EfEMJeW00AdHgpttiCv33fCgCJFP3kcoDQzsifWIVEnCR2PbVqe3x0-7GkuQ_EuMq3nt5p8CzFSYxUiXVSTCt1yu7cOHcradLWeYIAoBJEhDTfIft1BFtnvWgg5xh"/>
                  <div>
                    <p className="text-lg font-semibold text-gray-800">Liam Foster</p>
                    <p className="text-sm text-red-500">In Match</p>
                    <p className="text-sm text-gray-500">Level 12 | Current Game: Team Deathmatch. Clutching the win for the team.</p>
                  </div>
                </div>
                <button className="p-2 rounded-full hover:bg-gray-200">
                  <span className="material-icons text-gray-500">edit</span>
                </button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img alt="Ava Mitchell's avatar" className="h-14 w-14 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxZM9K-8vt-qxJIrw8MRyAUnt0oy7mzTd7F9JRhoryrrDUDtCrqAh_ARrn1XTrqT-HJMUwfQGQR6jbfHspEY8-HbvSnYKnRu9fHUdmjfkmy-pWVsuZidVxbi3TpgISrxlmUfnkPaJB475MEs0-gX7Ol4ySSaiVeafuooOj0O2tNJ362GrX2XvlP2KoQAxR0v0CaH2h4o1i5k_5IpkzvX_tNpK-S3tkw-PFGdx6idGYNaxdw6dez1BRrjSwatKvEuwnscAjnmNeC1Mc"/>
                  <div>
                    <p className="text-lg font-semibold text-gray-800">Ava Mitchell</p>
                    <p className="text-sm text-green-500">Online</p>
                    <p className="text-sm text-gray-500">Level 7 | Idle, customizing her character's loadout for the next game.</p>
                  </div>
                </div>
                <button className="p-2 rounded-full hover:bg-gray-200">
                  <span className="material-icons text-gray-500">edit</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}