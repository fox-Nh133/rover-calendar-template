document.addEventListener('DOMContentLoaded', () => {
    // Get all "navbar-burger" elements
    const $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);

    // Check if there are any navbar burgers
    if ($navbarBurgers.length > 0) {

      // Add a click event on each of them
      $navbarBurgers.forEach(el => {
        el.addEventListener('click', () => {

          // Get the target from the "data-target" attribute
          const target = el.dataset.target;
          const $target = document.getElementById(target);

          // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
          el.classList.toggle('is-active');
          $target.classList.toggle('is-active');

        });
      });
    }

    // Register service worker
    async function registerServiceWorker() {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.register("/service-worker.js", {
            scope: "/",
          });
          if (registration.installing) {
            console.log("Service worker installing");
          } else if (registration.waiting) {
            console.log("Service worker installed");
          } else if (registration.active) {
            console.log("Service worker active");
          }
          // return the registration object
          return registration;
        } catch (error) {
          console.error(`Registration failed with ${error}`);
        }
      }
    }
    
    // Ask for notification permission
    async function askPermission() {
      try {
        const permissionResult = await Notification.requestPermission();
        if (permissionResult !== 'granted') {
          throw new Error('We weren\'t granted permission.');
        }
      } catch (error) {
        console.error('Notification permission request failed', error);
      }
    }

    // Subscribe to Push
    async function subscribeUserToPush(registration) {
      try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          console.log('User is already subscribed:', subscription);
          return subscription;
        }

        const response = await fetch('/vapidPublicKey');
        const vapidPublicKey = await response.text();
        const convertedVapidKey = urlB64ToUint8Array(vapidPublicKey);

        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        console.log('New subscription:', newSubscription);
        // サーバーに新しいサブスクリプションを送信
        await fetch('/subscribe', {
          method: 'POST',
          body: JSON.stringify(newSubscription),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        return newSubscription;
      } catch (error) {
        console.error('Failed to subscribe the user:', error);
      }
    }

    function urlB64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    (async () => {
      const registration = await registerServiceWorker();
      await askPermission();
      await subscribeUserToPush(registration);
    })();
    
    // init monthly calendar (fullcalendar integration)
    //// parse json data
    async function getEventData() {
      const response = await fetch('backend/expanded-calendar.json');
      const data = await response.json();
      const events = data.map(event => {
        // create Date  object
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
      
        // Check if endDate is at 0:00, if so, adjust it to the day before
        if (endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0) {
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23);
          endDate.setMinutes(59);
          endDate.setSeconds(59);
        }
        return {
          id: event.uid,
          title: event.summary,
          start: startDate,
          end: endDate,
          description: event.description,
          location: event.location
        }
      });
      return events;
    }
    
    //// check if two dates are the same
    function isSameDate(date1, date2) {
      return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
    }

    //// --debug print out--
    getEventData().then(events => console.log(events)).catch(error => console.error('Error fetching events:', error));

    //// init fullcalendar
    let calendar; // Define calendar object outside the promise chain

    getEventData().then(fullCalendarEvents => {
      const calendarEl = document.getElementById('mainCalendar');
      calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: 'auto',
        events: fullCalendarEvents,
        eventClick: function(info) {
          // set event title
          document.getElementById('eventTitle').textContent = info.event.title;
          // set event start date
          let startDateOptions, endDateOptions;
          if (info.event.start.getHours() === 0 && info.event.start.getMinutes() === 0 && info.event.start.getSeconds() === 0) {
            startDateOptions = { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'asia/Tokyo'};
          } else {
            startDateOptions = { weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZone: 'asia/Tokyo'};
          }
          document.getElementById('eventStartDate').textContent = info.event.start.toLocaleString('ja-JP', startDateOptions);
          // set event end date
          if (isSameDate(info.event.start, info.event.end)) {
            if (info.event.end.getHours() === 23 && info.event.end.getMinutes() === 59 && info.event.end.getSeconds() === 59) {
              endDateOptions = { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'asia/Tokyo'};
            } else {
              endDateOptions = { hour: 'numeric', minute: 'numeric', timeZone: 'asia/Tokyo' };
            }
            document.getElementById('eventEndDate').textContent = info.event.end.toLocaleString('ja-JP', endDateOptions);
          } else {
            if (info.event.end.getHours() === 23 && info.event.end.getMinutes() === 59 && info.event.end.getSeconds() === 59) {
              endDateOptions = { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'asia/Tokyo'};
            } else {
              endDateOptions = { hour: 'numeric', minute: 'numeric', timeZone: 'asia/Tokyo' };
            }
            document.getElementById('eventEndDate').textContent = info.event.end.toLocaleString('ja-JP', endDateOptions);
          }
          // set event location and description
          document.getElementById('eventLocation').textContent = info.event.extendedProps.location;
          document.getElementById('eventDescription').innerHTML = info.event.extendedProps.description;
          // set event id
          document.getElementById('eventId').textContent = info.event.id;
          // show event details
          document.getElementById('eventDetails').style.display = 'block';
        }
      });
      calendar.render();
    }).catch(err => console.error(err));

    //// init calendar view switch
    const changeViewButton = document.getElementById('listViewCheckbox');
    changeViewButton.addEventListener('click', function() {
      if (changeViewButton.checked) {
        calendar.changeView('listMonth');
      } else {
        calendar.changeView('dayGridMonth');
      }
    });

    // close event details
    const closeEventDetails = document.querySelectorAll('.close-event-details');

    closeEventDetails.forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('eventDetails').style.display = 'none';
      });
    });

    // export event as ics file
    const exportEvent = document.getElementById('exportEvent');
    async function getEventById(eventId) {
      const events = await getEventData();
      console.log(events); // データ配列を確認
      console.log('Searching for Event ID:', eventId); // 検索中のIDを確認
      const event = events.find(event => event.id === eventId);
      return event;
    }
    function formatICSDate(date) {
      const pad = num => num.toString().padStart(2, '0');
      return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    }

    exportEvent.addEventListener('click', () => {
      const eventId = document.getElementById('eventId').textContent;
      getEventById(eventId).then(event => {
        const icsParts = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'CALSCALE:GREGORIAN',
          'BEGIN:VEVENT',
          `SUMMARY:${event.title}`,
          `DTSTART:${formatICSDate(new Date(event.start))}`,
          `DTEND:${formatICSDate(new Date(event.end))}`,
          `LOCATION:${event.location}`,
          `DESCRIPTION:${event.description}`,
          'STATUS:CONFIRMED',
          'END:VEVENT',
          'END:VCALENDAR'
        ];
        // create ics file
        const icsData = icsParts.join('\r\n');
        const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
        // create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'event.ics';
        link.click();
        // cleanup
        window.URL.revokeObjectURL(url);
      }
      ).catch(err => console.error(err));
    });

    // init current date
    var today = new Date();
    var options = { month: 'long', day: 'numeric' };
    var weekday = { weekday: 'long' };

    var formattedDate = today.toLocaleDateString('ja-JP', options);
    var formattedWeekday = today.toLocaleDateString('ja-JP', weekday);

    document.getElementById('currentDate').textContent = formattedDate;
    document.getElementById('currentDay').textContent = formattedWeekday;

    // init closest event window
    //// get closest event
    getEventData().then(events => {
      const closestEvent = events.filter(event => new Date(event.start) > today).sort((a, b) => new Date(a.start) - new Date(b.start))[0];
      console.log(closestEvent);
      return closestEvent;
    }).then(closestEvent => {
      if (closestEvent) {
        // set event title
        document.getElementById('closestEventTitle').innerText = closestEvent.title;
        // set event start date
        let startDateOptions, endDateOptions;
        if (closestEvent.start.getHours() === 0 && closestEvent.start.getMinutes() === 0 && closestEvent.start.getSeconds() === 0) {
          startDateOptions = { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'asia/Tokyo'};
        } else {
          startDateOptions = { weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZone: 'asia/Tokyo'};
        }
        document.getElementById('closestEventStartDate').textContent = closestEvent.start.toLocaleString('ja-JP', startDateOptions);
        // set event end date
        if (isSameDate(closestEvent.start, closestEvent.end)) {
          if (closestEvent.end.getHours() === 23 && closestEvent.end.getMinutes() === 59 && closestEvent.end.getSeconds() === 59) {
            endDateOptions = { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'asia/Tokyo'};
          } else {
            endDateOptions = { hour: 'numeric', minute: 'numeric', timeZone: 'asia/Tokyo' };
          }
          document.getElementById('closestEventEndDate').textContent = closestEvent.end.toLocaleString('ja-JP', endDateOptions);
        } else {
          if (closestEvent.end.getHours() === 23 && closestEvent.end.getMinutes() === 59 && closestEvent.end.getSeconds() === 59) {
            endDateOptions = { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'asia/Tokyo'};
          } else {
            endDateOptions = { hour: 'numeric', minute: 'numeric', timeZone: 'asia/Tokyo' };
          }
          document.getElementById('closestEventEndDate').textContent = closestEvent.end.toLocaleString('ja-JP', endDateOptions);
        }
        // set event location and description
        document.getElementById('closestEventLocation').textContent = closestEvent.location;
        document.getElementById('closestEventDescription').innerHTML = closestEvent.description;
      } else {
        document.getElementById('closestEventDate').textContent = 'No upcoming events';
      }
    }).catch(err => console.error(err));

    // copy ical url
    copyICALUrl = document.getElementById('copyICALUrl');
    function copyICALToClipboard() {
      const icalURL = document.getElementById('icalURL');
      icalURL.select();
      icalURL.setSelectionRange(0, 99999); // for mobile devices
      document.execCommand('copy');
    }

    copyICALUrl.addEventListener('click', copyICALToClipboard);

});
