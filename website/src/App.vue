<template>
  <div>
    <div style="position:relative; height: 70px;">
      <img src="/logo_h.png" @click="page = 'map'"
        style="height:40px; margin-top:10px; margin-left:10px; cursor: pointer;" />
      <span @click="page = 'contribute'" v-if="page === 'map'" class="menu-btn">
        CONTRIBUISCI
      </span>
      <span @click="page = 'map'" v-if="page === 'contribute'" class="menu-btn">
        MAPPA
      </span>
    </div>
    <div v-if="page === 'map'" style="text-align: center;">
      <div style="position:relative;padding:0 30px 0 0 ">
        <input type="text" placeholder="Cerca un indirizzo..."
          style="width: 100%; padding: 10px 15px; display: inline-block; border: 0; border-radius: 15px; margin-bottom: 10px;"
          v-model="searcher" /><br>
        <div v-if="searching" style="position:absolute; top: 10px; right: 10px; color: #000; font-size: 10px;">
          ...
        </div>
        <div v-if="searcher.length > 0" @click="initMap(); searcher = ''; results = [];"
          style="cursor: pointer;position:absolute; top: 10px; right: 10px; color: #000; font-size: 10px;">
          RESET
        </div>
        <div v-if="results"
          style="position: absolute; top:38px; border-radius:5px; left: 0; width:100%; z-index: 99; max-height: 190px; overflow-y: auto;">
          <div v-for="result in results" @click="searchMarkers(result.center)"
            style="padding: 10px; cursor:pointer; font-size:10px; background:#fff; border-bottom:1px solid #bbb; color:#000">
            {{ result.place_name }}
          </div>
        </div>
      </div>
      <div id="map"></div>
      <div @click="locateUser"
        style="position: fixed; bottom:45px; right:5px; background:#499643; width:80px; height: 80px; line-height: 80px; cursor: pointer; border: 1px solid #fff; font-size: 35px; border-radius:50px; z-index:99; ">
        <i class="fa-solid fa-location-arrow"></i>
      </div>
    </div>
    <div class="content" v-if="page === 'privacy'">
      <h1>Privacy Policy</h1>
      <p>
        We don't collect any data, period.<br><br>
        We don't use cookies, period.<br><br>
        We don't use Google Analytics, period.<br><br>
        We don't use any other tracking software, period.<br><br>
        Check by your own at <a
          href="https://github.com/yomi-digital/munnizza-land/tree/master/website">https://github.com/yomi-digital/munnizza-land</a>
      </p>
    </div>
    <div class="content" v-if="page === 'contribute'">
      <h2>Come funziona?</h2>
      Scegli la tua applicazione di messaggistica preferita e clicca per iniziare la chat 💬.<br><br>
      Tramite la chat potrai inviare la foto 📸 e la posizione 📍 della segnalazione!<br><br>
      Le segnalazioni sono tutte completamente anonime 🥸 per cui non temere per la tua privacy!<br><br><br>
      <a class="btn" href="https://wa.me/393312296579?text=Vorrei%20contribuire!"><i class="fa-brands fa-whatsapp"></i>
        WHATSAPP</a><br><br>
      <a class="btn" href="https://t.me/munnizzaland_bot"><i class="fa-brands fa-telegram"></i> TELEGRAM</a><br><br>
    </div>
    <div
      style="text-align: center; margin-top: 10px; background-color: #499643; font-size: 9px; position:fixed; bottom:0;left:0;width:100%;padding:20px 0">
      Munnizza.Land è un progetto
      <a href="https://github.com/yomi-digital/munnizza-land" target="_blank">open-source</a>
      realizzato da <a href="https://yomi.digital" target="_blank">YOMI</a>
    </div>
  </div>
</template>
<style>
body,
html {
  background: #499643;
  height: 100vh;
  overflow: hidden;
  font-family: "Roboto Mono", monospace !important;
  color: #fff;
}

.content {
  text-align: center;
  padding: 0 20px;
  height: calc(100vh - 135px);
  overflow-y: auto;
}

a {
  color: #eee;
  text-decoration: underline;
}

.btn {
  padding: 20px;
  text-decoration: none;
  border: 1px solid #fff;
  border-radius: 30px;
  display: inline-block;
}

.btn:hover {
  background-color: #fff;
  color: #499643;
}

.info-window {
  color: black;
}

.open-photo {
  position: absolute;
  bottom: 15px;
  right: 8px;
}

.open-photo a {
  color: #499643;
  text-decoration: none;
  font-size: 20px;
  margin: 0 5px;
}

.menu-btn {
  position: absolute;
  top: 0;
  right: 0;
  padding: 23px;
  cursor: pointer;
  font-size: 13px;
  text-decoration: none;
  font-weight: bold;
}

.button {
  font-family: "Roboto Mono", monospace !important;
}

#map {
  height: calc(100vh - 130px);
  border-radius: 15px;
  border-bottom-right-radius: 130px;
}
</style>
<script>
import axios from "axios";
import { Loader } from "@googlemaps/js-api-loader"

export default {
  name: "Home",
  async mounted() {
    // Get URL
    const app = this;
    const url = new URL(window.location.href);
    if (url.hash === "#/privacy" || url.hash === "#/terms") {
      this.page = "privacy";
    } else if (url.hash === "#/contribuisci") {
      this.page = "contribute";
    } else {
      this.page = "map";
    }
  },
  watch: {
    page: function (val) {
      if (val === "map") {
        this.initMap();
      }
    },
    searcher: function () {
      clearTimeout(this.searchDelay)
      this.initSearch()
    }
  },
  data() {
    return {
      page: "",
      searcher: "",
      searching: false,
      searchDelay: null,
      results: [],
      map: null
    };
  },
  methods: {
    locateUser() {
      const app = this
      const successCallback = (position) => {
        console.log("Position accepted", position.coords)
        if (position.accuracy < 100) {
          app.initMap([position.coords.latitude, position.coords.longitude])
        } else {
          alert("Non siamo riusciti a localizzarti, riprova più tardi!")
        }
      };
      const errorCallback = (error) => {
        console.log(error);
      };
      navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    },
    showBig(photo) {
      window.open(photo, '_blank');
    },
    async initMap(userLocation = null) {
      // Downloading data from API
      // Init map object
      const maps = new Loader({
        apiKey: import.meta.env.VITE_MAPS_KEY,
        version: "weekly",
        mapTypeId: 'satellite'
      });
      maps.load().then(async (google) => {
        let center = { lat: 37.5107216, lng: 13.8660002 }
        let zoom = 7.3
        console.log("User location is:", userLocation)
        if (userLocation !== null) {
          center = { lat: userLocation[0], lng: userLocation[1] }
          zoom = 13
        }
        app.map = new google.maps.Map(document.getElementById("map"), { center, zoom });
        const markersDB = await axios.get(import.meta.env.VITE_API_URL + "/markers");
        // Init map markers
        const markers = [];
        const infoWindows = [];
        for (let k in markersDB.data) {
          const marker = markersDB.data[k];
          // Creating info window
          const data =
            new Date(marker.timestamp).getDate() +
            "/" +
            (new Date(marker.timestamp).getMonth() + 1) +
            "/" +
            new Date(marker.timestamp).getFullYear();
          infoWindows[marker.photo] = new google.maps.InfoWindow({
            content:
              `<div class="info-window">
          <img src="` +
              marker.photo +
              `" width="100%"><br><br>
              ` +
              data +
              `
              <div class="open-photo">
              <a href="https://www.google.com/maps/search/?api=1&query=${marker.location.coordinates[1]},${marker.location.coordinates[0]}" target="_blank">
                <i class="fa-solid fa-location-dot"></i>
              </a>
              <a href="${marker.photo}" target="_blank"><i class="fa-solid fa-camera"></i></a>
              </div></div>`,
          });
          // Init marker
          markers[marker._id] = new google.maps.Marker({
            position: {
              lat: marker.location.coordinates[1],
              lng: marker.location.coordinates[0],
            },
            map: app.map,
          });
          // Attach info window
          markers[marker._id].addListener("click", () => {
            for (let k in infoWindows) {
              infoWindows[k].close();
            }
            infoWindows[marker.photo].open({
              anchor: markers[marker._id],
              map,
            });
          });
        }
      })
    },
    async initSearch() {
      const app = this
      if (app.searcher.length > 3 && !app.searching) {
        app.searching = true
        const search = await axios.post(import.meta.env.VITE_API_URL + "/search", {
          search: app.searcher + ", Sicily, Italy"
        });
        app.searching = false
        console.log("Search results:", search.data)
        if (search.data.results.features !== undefined) {
          app.results = search.data.results.features
        }
      } else {
        app.searchDelay = setTimeout(function () {
          app.initSearch()
        }, 500)
      }
    },
    async searchMarkers(location) {
      const app = this
      app.results = []
      const markersDB = await axios.post(import.meta.env.VITE_API_URL + "/search", {
        location: location,
        distance: 50000
      });
      const maps = new Loader({
        apiKey: import.meta.env.VITE_MAPS_KEY,
        version: "weekly",
        mapTypeId: 'satellite'
      });
      maps.load().then(async (google) => {
        app.map = new google.maps.Map(document.getElementById("map"), {
          center: { lat: location[1], lng: location[0] },
          zoom: 13,
        });
        // Init map markers
        const markers = [];
        const infoWindows = [];
        for (let k in markersDB.data.markers) {
          const marker = markersDB.data.markers[k];
          // Creating info window
          const data =
            new Date(marker.timestamp).getDate() +
            "/" +
            (new Date(marker.timestamp).getMonth() + 1) +
            "/" +
            new Date(marker.timestamp).getFullYear();
          infoWindows[marker.photo] = new google.maps.InfoWindow({
            content:
              `<div class="info-window">
          <img src="` +
              marker.photo +
              `" width="100%"><br><br>
              ` +
              data +
              `
              <div class="open-photo">
              <a href="https://www.google.com/maps/search/?api=1&query=${marker.location.coordinates[1]},${marker.location.coordinates[0]}" target="_blank">
                <i class="fa-solid fa-location-dot"></i>
              </a>
              <a href="${marker.photo}" target="_blank"><i class="fa-solid fa-camera"></i></a>
              </div></div>`,
          });
          // Init marker
          markers[marker._id] = new google.maps.Marker({
            position: {
              lat: marker.location.coordinates[1],
              lng: marker.location.coordinates[0],
            },
            map: app.map,
          });
          // Attach info window
          markers[marker._id].addListener("click", () => {
            for (let k in infoWindows) {
              infoWindows[k].close();
            }
            infoWindows[marker.photo].open({
              anchor: markers[marker._id],
              map,
            });
          });
        }
      })
    }
  }
};
</script>
