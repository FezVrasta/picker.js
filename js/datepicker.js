import Base from './base'
import moment from 'moment'
import {main} from './templates'
import Keycodes from './util/keycodes'
import Key from './util/key'
import DateArray from './util/dateArray'
import Renderer from './renderer'
import {JQUERY_NAME, DATA_KEY, Event, Selector, ClassName, Unit, View} from './constants'
import DateRangePicker from './dateRangePicker'

/**
 * Datepicker for fields using momentjs for all date-based functionality.
 *
 * Internal dates are stored as UTC moments.  To use them in local time, execute moment.local() prior to formatting.
 */
const Datepicker = (($) => {

  const JQUERY_NO_CONFLICT = $.fn[JQUERY_NAME]
  const Default = {
    // lang defaults to en, most i18n comes from moment's locales.
    lang: 'en',
    // i18n - for the very few strings we use.
    i18n: {
      en: {
        today: 'Today',
        clear: 'Clear'
      }
    },

    autoclose: false, // Whether or not to close the datepicker immediately when a date is selected
    toggleActive: false, // If true, selecting the currently active date in the datepicker will unset the respective date. This option is always true when the multidate option is being used
    forceParse: true, // force parsing of the input value when the picker is closed. That is, when an invalid date is left in the input field by the user, the picker will forcibly parse that value, and set the input’s value to the new, valid date, conforming to the given format.
    keyboard: {
      navigation: true, // allow date navigation by arrow keys
      touch: true // false will disable keyboard on mobile devices
    },
    rtl: false,
    enableOnReadonly: true, // If false the datepicker will not show on a readonly datepicker field
    showOnFocus: true, // If false, the datepicker will be prevented from showing when the input field associated with it receives focus
    zIndexOffset: 10, // z-index of the open datepicker is the maximum z-index of the input and all of its DOM ancestors plus the zIndexOffset.
    container: 'body',
    immediateUpdates: false, // if true, selecting a year or month in the datepicker will update the input value immediately. Otherwise, only selecting a day of the month will update the input value immediately.
    title: '', // string that will appear on top of the datepicker. If empty the title will be hidden.
    today: {
      button: false, // If true or “linked”, displays a “Today” button at the bottom of the datepicker to select the current date. If true, the “Today” button will only move the current date into view if “linked”, the current date will also be selected.
      highlight: false // If true, highlights the current date.
    },

    //-----------------
    // view types:
    //    days(0) | months(1) | years(2) | decades(3) | centuries(4)
    view: {
      start: 'days', // The view that the datepicker should show when it is opened - string or digit
      min: 'days', // Set a minimum limit for the view mode
      max: 'centuries', // Set a maximum limit for the view mode
      modes: [
        {
          cssClass: ClassName.DAYS,
          navStep: 1
        },
        {
          cssClass: ClassName.MONTHS,
          navStep: 1
        },
        {
          cssClass: ClassName.YEARS,
          navStep: 10
        },
        {
          cssClass: ClassName.DECADES,
          navStep: 100
        },
        {
          cssClass: ClassName.CENTURIES,
          navStep: 1000
        }]
    },
    // ----------------
    // multi-dates
    //
    multidate: {
      // Enable multidate picking. Each date in month view acts as a toggle button, keeping track of which dates the user has selected in order. If a number is given, the picker will limit how many dates can be selected to that number, dropping the oldest dates from the list when the number is exceeded. true equates to no limit. The input’s value (if present) is set to a string generated by joining the dates, formatted, with multidate.separator
      enabled: false,
      // The string that will appear between dates when generating the input’s value. When parsing the input’s value for a multidate picker, this will also be used to split the incoming string to separate multiple formatted dates as such, it is highly recommended that you not use a string that could be a substring of a formatted date (eg, using ‘-‘ to separate dates when your format is ‘yyyy-mm-dd’).
      separator: ','
    },
    week: {
      start: 0 // Day of the week start. 0 (Sunday) to 6 (Saturday)
      // end is calculated based on start
    },
    // format: // pass in a momentjs compatible format, or it will default to L based on locale
    date: {
      //start: default: beginning of time - The earliest date that may be selected all earlier dates will be disabled.
      //end:  default: end of time - The latest date that may be selected all later dates will be disabled
      disabled: [] // Single or Array of disabled dates - can be string or moment
      //'default': // default is today - can be a string or a moment
    },
    daysOfWeek: {
      // Values are 0 (Sunday) to 6 (Saturday)
      disabled: [],   // Days of the week that should be disabled. Example: disable weekends: [0,6]
      highlighted: [] // Days of the week that should be highlighted. Example: highlight weekends: [0,6].
    },

    // Popper.js options - see https://popper.js.org/
    popper: {
      // any popper.js options are valid here and will be passed to that component
      placement: 'right'
    },

    template: main,

    // -------------------
    // callbacks  FIXME: better way to do this?

    /*
     A function that takes a date as a parameter and returns one of the following values:

     - undefined to have no effect
     - An object with the following properties:
     selectable: A Boolean, indicating whether or not this date is selectable
     classes: A String representing additional CSS classes to apply to the date’s cell
     tooltip: A tooltip to apply to this date, via the title HTML attribute
     */
    beforeShowDay: undefined,
    beforeShowMonth: undefined,
    beforeShowYear: undefined,
    beforeShowDecade: undefined,
    beforeShowCentury: undefined
  }

  /**
   * ------------------------------------------------------------------------
   * Class Definition
   * ------------------------------------------------------------------------
   * TODO: break this into components - ConfigurationManager(? not sure on this one), DateManager, EventManager, Renderer?
   */
  class Datepicker extends Base {

    constructor($element, ...configs) {
      super(Default, ...configs)

      this.$element = $element
      this.dates = new DateArray()

      // get our own utc instance and configure the locale
      this.moment = this.newMoment()

      // disallow updates during setup, call after
      this.allowUpdate = false

      // normalize options that are flexible
      this.normalizeConfig()

      //
      this.viewDate = this.config.date.default
      this.focusDate = null

      // inline datepicker if target is a div
      this.isInline = this.$element.is('div')
      this.isInput = this.$element.is('input')

      // component? FIXME: better name?
      this.component = this.$element.hasClass('date') ? this.$element.find('.add-on, .input-group-addon, .btn') : false
      this.hasInput = this.component && this.$element.find('input').length
      if (this.component && this.component.length === 0)
        this.component = false

      // initialize the renderer and create the $picker element
      this.renderer = new Renderer(this)

      //
      this.events = []
      this.secondaryEvents = []

      this.buildEvents()
      this.attachEvents()

      if (this.isInline) {
        this.renderer.$picker.addClass(ClassName.INLINE).appendTo(this.$element)
      }
      else {
        this.renderer.$picker.addClass(ClassName.DROPDOWN)
      }

      if (this.config.rtl) {
        this.renderer.$picker.addClass(ClassName.RTL)
      }

      this.viewMode = this.config.view.start

      this.renderer.fillDow()
      this.renderer.renderMonths()  // FIXME see definition for notes
      this.allowUpdate = true
      this.update()
      this.showMode()

      if (this.isInline) {
        this.show()
      }
    }

    dispose(dataKey = DATA_KEY) {
      this.hide()
      this.detachEvents()
      this.detachSecondaryEvents()
      this.renderer.dispose()
      this.renderer = null
      super.dispose(dataKey)
    }

    /**
     * @returns a new UTC moment configured with the locale
     */
    newMoment(...args) {
      let m = null

      if(args.length < 1) {
        // if no args, use the current date/time (cannot pass in null otherwise time is zeroed)
        m = moment()
      }
      else{
        m = moment(args)
      }

      m.utc()
      m.locale(this.config.lang)
      return m
    }

    /**
     * @returns the lower date limit on the datepicker.
     */
    getDateStart() {
      return this.config.date.start
    }


    /**
     * @returns the upper date limit on the datepicker
     */
    getDateEnd() {
      return this.config.date.end
    }

    /**
     * For use with multidate pickers.
     * @returns - array of UTC moments representing the internal date objects of the first datepicker in the selection.
     */
    getDates() {
      return this.dates.clonedArray()
    }

    /**
     * For multidate pickers, returns the latest date selected.
     * @returns - the latest UTC moment selected of the first datepicker in the selection.
     */
    getDate() {
      let m = this.dates.last()
      if (typeof m !== 'undefined') {
        return m.clone()
      }
      else {
        return null
      }
    }

    /**
     * Sets the internal date list. For use with multidate pickers.
     * @param dates - one or more String|moment - will be converted to UTC
     * @returns {Datepicker}
     */
    setDates(...dates) {
      this.update(...dates)
      return this
    }

    /**
     * @see #setDates
     * @param date
     */
    setDate(date) {
      this.setDates(date)
    }

    /**
     * Sets a new lower date limit on the datepicker.
     * Omit (or provide an otherwise falsey value) to unset the limit.
     * @param dateStart
     * @returns {Datepicker}
     */
    setDateStart(dateStart) {
      if (dateStart) {
        // verify/reparse
        this.config.date.start = this.parseDate(dateStart)
      }
      else {
        // default to beginning of time
        this.config.date.start = this.startOfAllTime()
      }
      // called from #normalizeConfig
      this.update()
      return this
    }

    /**
     * Sets a new upper date limit on the datepicker.
     * Omit (or provide an otherwise falsey value) to unset the limit.
     * @param dateEnd
     * @returns {Datepicker}
     */
    setDateEnd(dateEnd) {

      if (dateEnd) {
        // verify/reparse
        this.config.date.end = this.parseDate(dateEnd)
      }
      else {
        // default to beginning of time
        this.config.date.end = this.endOfAllTime()
      }
      // called from #normalizeConfig
      this.update()
      return this
    }

    /**
     * Sets the days that should be disabled
     * Omit (or provide an otherwise falsey value) to unset.
     * @param dates - String|Moment|Array of String|Moment
     * @returns {Datepicker}
     */
    setDatesDisabled(dates) {
      let dateArray = dates
      // Disabled dates
      if (!Array.isArray(dateArray)) {
        dateArray = [dateArray]
      }

      let newDisabled = []
      for (let d of dateArray) {
        newDisabled.push(this.parseDate(d))
      }
      this.config.date.disabled = newDisabled
      // called from #normalizeConfig
      this.update()
      return this
    }

    /**
     * Sets the days of week that should be disabled.  See config.daysOfWeek.disabled
     * Omit (or provide an otherwise falsey value) to unset.
     * @param days
     * @returns {Datepicker}
     */
    setDaysOfWeekDisabled(days) {
      this.config.daysOfWeek.disabled = days
      this.normalizeConfig()
      this.update()
      return this
    }

    /**
     * Sets the days of week that should be highlighted. See config.daysOfWeek.highlighted
     * Omit (or provide an otherwise falsey value) to unset.
     * @param days
     * @returns {Datepicker}
     */
    setDaysOfWeekHighlighted(days) {
      this.config.daysOfWeek.highlighted = days
      this.normalizeConfig()
      this.update()
      return this
    }

    // ------------------------------------------------------------------------
    // protected

    /**
     *
     * @param range - a {DateRange} from moment-range - provide a falsey value to unset
     */
    setRange(range) {
      this.range = range
      this.renderer.fill();
    }

    // ------------------------------------------------------------------------
    // private
    showMode(dir) {
      if (dir) {
        this.viewMode = Math.max(this.config.view.min, Math.min(this.config.view.max, this.viewMode + dir))
      }
      this.renderer.$picker
        .children('div')
        .hide()
        .filter(`.${this.config.view.modes[this.viewMode].cssClass}`) // days|months|years|decades|centuries
        .show()
      this.renderer.updateNavArrows()  // FIXME: redundant?
    }

    buildEvents() {
      let events = {
        keyup: (ev) => this.keyup(ev),
        keydown: (ev) => this.keydown(ev),
        paste: (ev) => this.paste(ev)
      }

      if (this.config.showOnFocus === true) {
        events.focus = () => this.show()
      }

      if (this.isInput) { // single input
        this.events = [
          [this.$element, events]
        ]
      }
      else if (this.component && this.hasInput) { // component: input + button
        this.events = [
          // For components that are not readonly, allow keyboard nav
          [this.$element.find('input'), events],
          [this.component, {
            click: () => this.show()
          }]
        ]
      }
      else if (this.isInline) {  // inline datepicker
        //this.isInline = true
        //       kross moved this to constructor
        // legacy, do we need to avoid else
      }
      else {
        this.events = [
          [this.$element, {
            click: () => this.show(),
            keydown: (ev) => this.keydown(ev)
          }]
        ]
      }
      this.events.push(
        // Component: listen for blur on element descendants
        [this.$element, '*', {
          blur: (ev) => {
            this.focusedFromElement = ev.target
          }
        }],
        // Input: listen for blur on element
        [this.$element, {
          blur: (ev) => {
            this.focusedFromElement = ev.target
          }
        }]
      )

      if (this.config.immediateUpdates) {
        // Trigger input updates immediately on changed year/month
        this.events.push([this.$element, {
          'changeYear changeMonth': (e) => {
            this.update(e.date)
          }
        }])
      }

      this.secondaryEvents = [
        [this.renderer.$picker, {
          click: (ev) => this.click(ev)
        }],
        //[$(window), {
        //  resize: () => this.renderer.place()
        //}],
        [$(document), {
          mousedown: (ev) => {
            // Clicked outside the datepicker, hide it
            if (!(
                this.$element.is(ev.target) ||
                this.$element.find(ev.target).length ||
                this.renderer.$picker.is(ev.target) ||
                this.renderer.$picker.find(ev.target).length ||
                this.renderer.$picker.hasClass('datepicker-inline')
              )) {
              this.hide()
            }
          }
        }]
      ]
    }

    /**
     *
     * @param date - start date
     * @param dir - direction/number of units
     * @param unit - day|month|year etc to use with moment#add
     * @returns {*}
     */
    moveAvailableDate(date, dir, unit) {
      let m = date.clone()
      do {
        m = m.add(dir, unit)
        //m = this[fn](m, dir)

        if (!this.dateWithinRange(m))
          return false

        unit = Unit.DAY
      }
      while (this.dateIsDisabled(m))

      return m
    }


    toggleMultidate(date) {
      var index = this.dates.contains(date)
      if (!date) {
        this.dates.clear()
      }

      if (index !== -1) {
        if (this.config.multidate.enabled === true || this.config.multidate.enabled > 1 || this.config.toggleActive) {
          this.dates.remove(index)
        }
      }
      else if (this.config.multidate.enabled === false) {
        this.dates.clear()
        this.dates.push(date)
      }
      else {
        this.dates.push(date)
      }

      if (typeof this.config.multidate.enabled === 'number')
        while (this.dates.length() > this.config.multidate.enabled)
          this.dates.remove(0)
    }

    // FIXME: this was called _setDate - WHY? different than #setDate, can this use setDate?
    clickDate(date, which) {
      if (!which || which === 'date') {
        this.toggleMultidate(date)
      }
      if (!which || which === 'view') {
        this.viewDate = date
      }

      this.renderer.fill()
      this.setInputValue()
      if (!which || which !== 'view') {
        this._trigger(Event.DATE_CHANGE)
      }
      let $e
      if (this.isInput) {
        $e = this.$element
      }
      else if (this.component) {
        $e = this.$element.find('input')
      }
      if ($e) {
        $e.change()
      }
      if (this.config.autoclose && (!which || which === 'date')) {
        this.hide()
      }
    }

    click(ev) {
      ev.preventDefault()
      ev.stopPropagation()

      let $target = $(ev.target)

      // Clicked on the switch
      if ($target.hasClass(ClassName.SWITCH)) {
        this.showMode(View.MONTHS)
      }

      // Clicked on prev or next
      let $navArrow = $target.closest(`${Selector.PREV}, ${Selector.NEXT}`)
      if ($navArrow.length > 0) {
        let dir = this.config.view.modes[this.viewMode].navStep * ($navArrow.hasClass(ClassName.PREV) ? -1 : 1)
        if (this.viewMode === View.DAYS) {
          this.viewDate.add(dir, Unit.MONTH)
          this._trigger(Event.MONTH_CHANGE, this.viewDate)
        }
        else {
          this.viewDate.add(dir, Unit.YEAR)
          if (this.viewMode === View.MONTHS) {
            this._trigger(Event.YEAR_CHANGE, this.viewDate)
          }
        }
        this.renderer.fill()
      }

      // Clicked on today button
      if ($target.hasClass(ClassName.TODAY)) {
        this.showMode(-2)
        this.clickDate(this.newMoment(), this.config.today.button === 'linked' ? null : 'view')
      }

      // Clicked on clear button
      if ($target.hasClass(ClassName.CLEAR)) {
        this.clearDates()
      }

      if (!$target.hasClass(ClassName.DISABLED)) {
        // Clicked on a day
        if ($target.hasClass(Unit.DAY)) {
          let day = parseInt($target.text(), 10) || 1
          let year = this.viewDate.year()
          let month = this.viewDate.month()
          let monthChanged = false
          let yearChanged = false

          // From last month
          if ($target.hasClass(ClassName.OLD)) {
            if (month === 0) {
              month = 11
              year = year - 1
              monthChanged = true
              yearChanged = true
            }
            else {
              month = month - 1
              monthChanged = true
            }
          }

          // From next month
          if ($target.hasClass(ClassName.NEW)) {
            if (month === 11) {
              month = 0
              year = year + 1
              monthChanged = true
              yearChanged = true
            }
            else {
              month = month + 1
              monthChanged = true
            }
          }
          this.clickDate(this.newMoment(year, month, day))
          if (yearChanged) {
            this._trigger(Event.YEAR_CHANGE, this.viewDate)
          }
          if (monthChanged) {
            this._trigger(Event.MONTH_CHANGE, this.viewDate)
          }
        }

        // Clicked on a month
        if ($target.hasClass(Unit.MONTH)) {
          this.viewDate.date(1)
          let day = 1
          let month = $target.parent().find('span').index($target)
          let year = this.viewDate.year()
          this.viewDate.month(month)
          this._trigger(Event.MONTH_CHANGE, this.viewDate)
          if (this.config.view.min === View.MONTHS) {
            this.clickDate(this.newMoment(year, month, day))
            this.showMode()
          }
          else {
            this.showMode(-1)
          }
          this.renderer.fill()
        }

        // Clicked on a year|decade|century
        if ($target.hasClass(Unit.YEAR)
          || $target.hasClass(Unit.DECADE)
          || $target.hasClass(Unit.CENTURY)) {
          //this.viewDate.startOf(Unit.MONTH)

          let year = parseInt($target.text(), 10) || 0
          this.viewDate.year(year)

          if ($target.hasClass(Unit.YEAR)) {
            this._trigger(Event.YEAR_CHANGE, this.viewDate)
          }
          if ($target.hasClass(Unit.DECADE)) {
            this._trigger(Event.DECADE_CHANGE, this.viewDate)
          }
          if ($target.hasClass(Unit.CENTURY)) {
            this._trigger(Event.CENTURY_CHANGE, this.viewDate)
          }

          if (this.config.view.min === View.YEARS) {
            this.clickDate(this.viewDate)
          }
          this.showMode(-1)
          this.renderer.fill()
        }
      }

      if (this.renderer.isShowing() && this.focusedFromElement) {
        $(this.focusedFromElement).focus()
      }
      this.focusedFromElement = undefined
    }


    // FIXME: nomenclature to be onKe*
    keyup(ev) {
      if (Key.isNot(ev,
          Keycodes.ESC,
          Keycodes.LEFT,
          Keycodes.RIGHT,
          Keycodes.UP,
          Keycodes.DOWN,
          Keycodes.SPACE,
          Keycodes.ENTER,
          Keycodes.TAB))
        this.update()
    }

    // FIXME: nomenclature to be onKe*
    keydown(ev) {
      if (!this.renderer.isShowing()) {
        if (Key.is(ev, Keycodes.DOWN, Keycodes.ESC)) { // allow down to re-show picker
          this.show()
          ev.stopPropagation()
        }
        return
      }
      let dateChanged = false
      let dir = null
      let newViewDate = null
      let focusDate = this.focusDate || this.viewDate

      switch (ev.keyCode) {
        case Keycodes.ESC:
          if (this.focusDate) {
            this.focusDate = null
            this.viewDate = this.dates.last() || this.viewDate
            this.renderer.fill() // FIXME: why not use this.update()?
          }
          else
            this.hide()
          ev.preventDefault()
          ev.stopPropagation()
          break
        case Keycodes.LEFT:
        case Keycodes.UP:
        case Keycodes.RIGHT:
        case Keycodes.DOWN:
          if (!this.config.keyboard.navigation || this.config.daysOfWeek.disabled.length === 7)
            break
          dir = Key.is(ev, Keycodes.LEFT, Keycodes.UP) ? -1 : 1
          if (this.viewMode === View.DAYS) {
            if (ev.ctrlKey) {
              newViewDate = this.moveAvailableDate(focusDate, dir, Unit.YEAR)

              if (newViewDate)
                this._trigger(Event.YEAR_CHANGE, this.viewDate)
            }
            else if (ev.shiftKey) {
              newViewDate = this.moveAvailableDate(focusDate, dir, Unit.MONTH)

              if (newViewDate)
                this._trigger(Event.MONTH_CHANGE, this.viewDate)
            }
            else if (Key.is(ev, Keycodes.LEFT, Keycodes.RIGHT)) {
              newViewDate = this.moveAvailableDate(focusDate, dir, Unit.DAY)
            }
            else if (!this.weekOfDateIsDisabled(focusDate)) {
              newViewDate = this.moveAvailableDate(focusDate, dir, Unit.WEEK)
            }
          }
          else if (this.viewMode === View.MONTHS) {
            if (Key.is(ev, Keycodes.UP, Keycodes.DOWN)) {
              dir = dir * 4
            }
            newViewDate = this.moveAvailableDate(focusDate, dir, Unit.MONTH)
          }
          else if (this.viewMode === View.YEARS) {
            if (Key.is(ev, Keycodes.UP, Keycodes.DOWN)) {
              dir = dir * 4
            }
            newViewDate = this.moveAvailableDate(focusDate, dir, Unit.YEAR)
          }
          if (newViewDate) {
            this.focusDate = this.viewDate = newViewDate
            this.setInputValue()
            this.renderer.fill() // FIXME: why not use this.update()?
            ev.preventDefault()
          }
          break
        case Keycodes.ENTER:
          if (!this.config.forceParse)
            break
          focusDate = this.focusDate || this.dates.last() || this.viewDate
          if (this.config.keyboard.navigation) {
            this.toggleMultidate(focusDate)
            dateChanged = true
          }
          this.focusDate = null
          this.viewDate = this.dates.last() || this.viewDate
          this.setInputValue()
          this.renderer.fill() // FIXME: why not use this.update()?
          if (this.renderer.isShowing()) {
            ev.preventDefault()
            ev.stopPropagation()
            if (this.config.autoclose)
              this.hide()
          }
          break
        case Keycodes.TAB:
          this.focusDate = null
          this.viewDate = this.dates.last() || this.viewDate
          this.renderer.fill() // FIXME: why not use this.update()?
          this.hide()
          break
      }
      if (dateChanged) {
        if (this.dates.length())
          this._trigger(Event.DATE_CHANGE)
        else
          this._trigger(Event.DATE_CLEAR)
        let element
        if (this.isInput) {
          element = this.$element
        }
        else if (this.component) {
          element = this.$element.find('input')
        }
        if (element) {
          element.change()
        }
      }
    }

    //FIXME: normalize these signatures? to be the same as #trigger in Base class?
    _trigger(event, altdate) {
      let date = null
      if (altdate) {
        date = altdate.clone()
      }
      else {
        date = this.dates.last()
        if (date) {
          //clone it if present
          date = date.clone()
        }
      }

      super.trigger(event, {
        type: event,
        date: date,
        dates: this.dates.clonedArray()
      })
    }

    // FIXME: nomenclature to be onKe*
    paste(ev) {
      let dateString = null
      if (ev.originalEvent.clipboardData && ev.originalEvent.clipboardData.types
        && $.inArray('text/plain', ev.originalEvent.clipboardData.types) !== -1) {
        dateString = ev.originalEvent.clipboardData.getData('text/plain')
      }
      else if (window.clipboardData) {
        dateString = window.clipboardData.getData('Text')
      }
      else {
        return
      }
      this.setDate(dateString)
      ev.preventDefault()
    }

    //
    show() {
      let element = this.component ? this.$element.find('input') : this.$element
      if (element.attr('readonly') && this.config.enableOnReadonly === false) {
        return
      }

      //if (!this.isInline) {
      //  this.renderer.$picker.appendTo(this.config.container)
      //}

      //this.renderer.place()
      //this.renderer.$picker.show()
      this.renderer.show()

      this.attachSecondaryEvents()
      this._trigger(Event.SHOW)
      if ((window.navigator.msMaxTouchPoints || 'ontouchstart' in document) && !this.config.keyboard.touch) {
        $(this.$element).blur()
      }
      return this
    }

    //isPickerVisible() {
    //  return this.renderer.$picker.is(':visible')
    //}

    hide() {
      if (this.isInline || !this.renderer.isShowing()) {
        return this
      }

      this.focusDate = null

      //this.renderer.$picker.hide().detach()
      this.renderer.hide()

      this.detachSecondaryEvents()
      this.viewMode = this.config.view.start
      this.showMode()

      if (this.config.forceParse &&
        (this.isInput && this.$element.val() || this.hasInput && this.$element.find('input').val())) {
        this.setInputValue()
      }
      this._trigger(Event.HIDE)
      return this
    }

    normalizeConfig() {
      // disallow updates - must call #update after
      let originalAllowUpdate = this.allowUpdate
      this.allowUpdate = false

      // Normalize views as view-type integers
      this.config.view.start = this.resolveViewType(this.config.view.start)
      this.config.view.min = this.resolveViewType(this.config.view.min)
      this.config.view.max = this.resolveViewType(this.config.view.max, View.YEARS) // default to years (slightly different than other view resolution)

      // Check that the start view is between min and max
      this.config.view.start = Math.min(this.config.view.start, this.config.view.max)
      this.config.view.start = Math.max(this.config.view.start, this.config.view.min)

      // Multi-dates
      // true, false, or Number > 0
      if (this.config.multidate.enabled !== true) {
        this.config.multidate.enabled = Number(this.config.multidate.enabled) || false
        if (this.config.multidate.enabled !== false)
          this.config.multidate.enabled = Math.max(0, this.config.multidate.enabled)
      }
      this.config.multidate.separator = String(this.config.multidate.separator)

      // Week
      this.config.week.start %= 7
      this.config.week.end = (this.config.week.start + 6) % 7

      // Format - setup the format or default to a momentjs format
      this.config.format = this.config.format || this.moment.localeData().longDateFormat('L')

      // Start/End or Min/max dates
      this.setDateStart(this.config.date.start)
      this.setDateEnd(this.config.date.end)
      this.setDatesDisabled(this.config.date.disabled)

      // Default date - if unspecified, it is now
      this.config.date.default = this.config.date.default || this.moment.clone()

      // restore allowUpdate
      this.allowUpdate = originalAllowUpdate
    }

    formatDate(mom, format = this.config.format) {
      return mom.format(format)
    }

    parseDates(...dates) {
      //if(!dates || dates.length < 1){
      //  return []
      //}

      let results = []
      for (let date of dates) {
        if (date) {
          results.push(this.parseDate(date))
        }
      }
      return results
    }

    parseDate(value, format = this.config.format) {
      // @see http://momentjs.com/docs/#/parsing/

      // return any current moment
      if (moment.isMoment(value)) {
        if (!value.isValid()) {
          this.throwError(`Invalid moment: ${value} provided.`)
        }

        return this.newMoment(value)
      }
      else if (typeof value === "string") {
        // parse with locale and strictness
        let m = moment(value, format, this.config.lang, true)

        if (!m.isValid()) {
          this.throwError(`Invalid moment: ${value} for format: ${format} and locale: ${this.config.lang}`)
        }

        return m
      }
      else {
        this.throwError(`Unknown value type ${typeof value} for value: ${this.dump(value)}`)
      }
    }

    shouldBeHighlighted(date) {
      return $.inArray(date.day(), this.config.daysOfWeek.highlighted) !== -1
    }

    weekOfDateIsDisabled(date) {
      return $.inArray(date.day(), this.config.daysOfWeek.disabled) !== -1
    }

    dateIsDisabled(date) {
      return (
        this.weekOfDateIsDisabled(date) ||
        $.grep(this.config.date.disabled,
          (d) => {
            return date.isSame(d, Unit.DAY)
          }
        ).length > 0
      )
    }

    dateWithinRange(date) {
      return date.isSameOrAfter(this.config.date.start) && date.isSameOrBefore(this.config.date.end)
    }

    startOfDay(moment = this.moment) {
      return moment.clone().startOf(Unit.DAY)
    }

    startOfAllTime(moment = this.moment) {
      return moment.clone().startOf(Unit.YEAR).year(0)
    }

    endOfAllTime(moment = this.moment) {
      return moment.clone().endOf(Unit.YEAR).year(2200) // ?? better value to set for this?
    }

    resolveViewType(view, defaultValue = View.DAYS) {
      if (typeof view === 'string') {
        let value = null
        switch (view) {
          case 'days':
            value = View.DAYS
            break
          case 'months':
            value = View.MONTHS
            break
          case 'years':
            value = View.YEARS
            break
          default:
            value = defaultValue
            break
        }
        return value
      }
      else {
        return view
      }
    }

    clearDates() {
      let element = null
      if (this.isInput) {
        element = this.$element
      }
      else if (this.component) {
        element = this.$element.find('input')
      }

      if (element) {
        element.val('')
      }

      this.update()
      this._trigger(Event.DATE_CHANGE)

      if (this.config.autoclose) {
        this.hide()
      }
    }


    /**
     *
     * @param date - one or more - String|moment - optional
     * @returns {Datepicker}
     */
    update(...moments) {
      if (!this.allowUpdate) {
        return this
      }

      let oldDates = this.dates.copy()
      this.dates = this.resolveDates(...moments)
      this.resolveViewDate()

      if (moments) {
        // args passed means setting date by clicking?  FIXME: how about making this more explicit?
        this.setInputValue()
      }
      else if (this.dates.length()) {
        // setting date by typing
        if (String(oldDates.array) !== String(this.dates.array))
          this._trigger(Event.DATE_CHANGE)
      }
      if (!this.dates.length() && oldDates.length()) {
        this._trigger(Event.DATE_CLEAR)
      }

      this.renderer.fill()
      this.$element.change()
      return this
    }

    setInputValue() {
      let formatted = this.getDateFormatted()
      if (!this.isInput) {
        if (this.component) {
          this.$element.find('input').val(formatted)  // FIXME: find $input in constructor and replace a bunch of these?
        }
      }
      else {
        this.$element.val(formatted)
      }
      return this
    }

    getDateFormatted(format = this.config.format) {
      return this.dates.formattedArray(format).join(this.config.multidate.separator)
    }

    resolveViewDate() {
      if (this.dates.length()) {
        this.viewDate = this.dates.last().clone()
      }
      else if (this.viewDate < this.config.date.start) {
        this.viewDate = this.config.date.start.clone()
      }
      else if (this.viewDate > this.config.date.end) {
        this.viewDate = this.config.date.end.clone()
      }
      else {
        this.viewDate = this.config.date.default.clone()
      }
    }

    /**
     * resolve a new {DateArray}
     *
     * @param dates
     * @returns {DateArray}
     */
    resolveDates(...dates) {
      let newDatesArray = null
      if (dates) {
        newDatesArray = this.parseDates(...dates)
      }
      else {
        if (this.isInput) {
          newDatesArray = this.$element.val()
        }
        else {
          newDatesArray = /*this.$element.data('date') ||*/ this.$element.find('input').val()
        }

        if (newDatesArray && this.config.multidate.enabled) {
          newDatesArray = newDatesArray.split(this.config.multidate.separator)
        }
        else {
          newDatesArray = [newDatesArray]
        }
        //delete this.$element.data().date
        newDatesArray = this.parseDates(...newDatesArray)
      }

      newDatesArray = $.grep(newDatesArray, (date) => {
        return (!this.dateWithinRange(date) || !date)
      }, true)

      return new DateArray(...newDatesArray)
    }


    attachEvents() {
      this.detachEvents()
      this.applyEvents(this.events)
    }

    detachEvents() {
      this.unapplyEvents(this.events)
    }

    attachSecondaryEvents() {
      this.detachSecondaryEvents()
      this.applyEvents(this.secondaryEvents)
    }

    detachSecondaryEvents() {
      this.unapplyEvents(this.secondaryEvents)
    }

    applyEvents(evs) {
      for (let i = 0, el, ch, ev; i < evs.length; i++) {
        el = evs[i][0]
        if (evs[i].length === 2) {
          ch = undefined
          ev = evs[i][1]
        }
        else if (evs[i].length === 3) {
          ch = evs[i][1]
          ev = evs[i][2]
        }
        el.on(ev, ch)
      }
    }

    unapplyEvents(evs) {
      for (let i = 0, el, ev, ch; i < evs.length; i++) {
        el = evs[i][0]
        if (evs[i].length === 2) {
          ch = undefined
          ev = evs[i][1]
        }
        else if (evs[i].length === 3) {
          ch = evs[i][1]
          ev = evs[i][2]
        }
        el.off(ev, ch)
      }
    }


    // ------------------------------------------------------------------------
    // static
    static _jQueryInterface(config) {
      //let methodResult = undefined
      return this.each(
        function () {
          let $element = $(this)
          let data = $element.data(DATA_KEY)
          // Options priority: js args, data-attrs, Default const
          let _config = $.extend(
            {},
            Default,
            $element.data(),
            typeof config === 'object' && config  // config could be a string method name.
          )

          // instantiate a Datepicker or a DateRangePicker
          if (!data) {
            // FIXME: I really think this should be encapsulated in DateRangePicker, and not here.
            if ($element.hasClass('input-daterange') || _config.inputs) {
              data = new DateRangePicker($element,
                $.extend(_config, {inputs: _config.inputs || $element.find('input').toArray()})
              )
            }
            else {
              data = new Datepicker($element, _config)
            }
            $element.data(DATA_KEY, data)
          }

          // call public methods jquery style
          if (typeof config === 'string') {
            if (data[config] === undefined) {
              throw new Error(`No method named "${config}"`)
            }
            //methodResult =
            data[config]()
          }
        }
      )

      //if (methodResult !== undefined) {
      //  // return method result if there is one
      //  return methodResult
      //}
      //else {
      //  // return the element
      //  return this
      //}
    }
  }

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */
  $(document).on(Event.CLICK_DATA_API, Selector.DATA_PROVIDE, function (event) {
    event.preventDefault()
    Datepicker._jQueryInterface.call(this, 'show')
  })

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */
  $.fn[JQUERY_NAME] = Datepicker._jQueryInterface
  $.fn[JQUERY_NAME].Constructor = Datepicker
  $.fn[JQUERY_NAME].noConflict = () => {
    $.fn[JQUERY_NAME] = JQUERY_NO_CONFLICT
    return Datepicker._jQueryInterface
  }

  return Datepicker

})(jQuery)

export default Datepicker
