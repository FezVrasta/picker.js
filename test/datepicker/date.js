import {$, $input, safeDispose, fromData, assertData, assertText, findPopper, findToday, findActiveDay, assertNotFound, assertVisible, assertHidden, assertDatesEqual, findDayOfMonth, prepare, YYYY_MM_DD, MM_DD_YYYY} from '../support'
import {Selector, ClassName} from '../../js/constants'
import moment from 'moment'

describe('Datepicker', () => {

  beforeEach(() => prepare())
  afterEach(() => safeDispose())

  describe('date', () => {

    describe('toggle', () => {
      describe('disabled', () => {
        it(`clicking twice on date should leave it selected`, () => {
          const expectedValue = `03/05/2012`
          const expected = moment(expectedValue, MM_DD_YYYY)
          $input.val(expected.format(MM_DD_YYYY)).datepicker()

          let dp = assertData()
          expect(dp.config.date.toggle, `config.date.toggle`).to.equal(false)

          dp.show()

          // Initial value is selected
          assertDatesEqual(dp.getDate(), expected)

          // click on our active date
          findActiveDay().click()

          // make sure it`s still set
          expect($input.val()).to.equal(expectedValue)
          assertDatesEqual(dp.getDate(), expected)
        })
      })


      describe('enabled', () => {
        it(`clicking twice on date should unselect it`, () => {
          const expectedValue = `03/05/2012`
          const expected = moment(expectedValue, MM_DD_YYYY)
          $input.val(expected.format(MM_DD_YYYY)).datepicker({date: {toggle: true}})

          let dp = assertData()
          expect(dp.config.date.toggle, `config.date.toggle`).to.equal(true)

          dp.show()

          // Initial value is selected
          assertDatesEqual(dp.getDate(), expected)
          expect($input.val()).to.equal(expectedValue)

          // click on our active date
          findActiveDay().click()

          // make sure it`s still set
          expect($input.val()).to.equal('')
          assertDatesEqual(dp.getDate(), null)
        })
      })
    })

    describe('count', () => {
      it(`clicking twice on date should unselect it`, () => {
        const expectedValue = `03/05/2012`
        const expected = moment(expectedValue, MM_DD_YYYY)

        const assertInitial = () => {
          expect(dp.getDates().length).to.equal(1)

          // getDates returns array in order selected
          assertDatesEqual(dp.getDates()[0], expected)

          // getDate returns the last date selected
          assertDatesEqual(dp.getDate(), expected)

          expect($input.val()).to.equal(expectedValue)
        }

        $input.val(expected.format(MM_DD_YYYY)).datepicker({date: {count: 2}})

        let dp = assertData()
        expect(dp.config.date.count, `config.date.count`).to.equal(2)

        dp.show()

        // Initial value is selected
        assertInitial()

        // Select additional date - 14
        findDayOfMonth('14').click()

        const expectedValue14 = `03/14/2012`
        const expected14 = moment(expectedValue14, MM_DD_YYYY)

        // input value using separator
        expect($input.val()).to.equal(`${expectedValue},${expectedValue14}`)
        // getDate returns the last date selected
        assertDatesEqual(dp.getDate(), expected14)
        // getDates returns array in order selected
        assertDatesEqual(dp.getDates()[0], expected)
        assertDatesEqual(dp.getDates()[1], expected14)
        expect(dp.getDates().length).to.equal(2)

        // Unselect the additional date `14`, should be same as initial (must re-find it to trigger click again)
        findDayOfMonth('14').click()
        assertInitial()
      })
    })

    describe('daysOfWeek', () => {

      describe('disabled', () => {
        it(`should be marked with a class`, () => {
          $input.val(`10/26/2012`).datepicker({
            daysOfWeek: {disabled: [1, 5]}
          })

          assertData().show()
          expect(findDayOfMonth('22')).to.have.class(ClassName.DISABLED)
          expect(findDayOfMonth('24')).not.to.have.class(ClassName.DISABLED)
          expect(findDayOfMonth('26')).to.have.class(ClassName.DISABLED)
        })
      })


      it(`highlighted`, () => {
        it(`should be marked with a class`, () => {
          $input.val(`10/26/2012`).datepicker({
            daysOfWeek: {highlighted: [1, 5]}
          })

          assertData().show()
          expect(findDayOfMonth('22')).to.have.class(ClassName.HIGHLIGHTED)
          expect(findDayOfMonth('24')).not.to.have.class(ClassName.HIGHLIGHTED)
          expect(findDayOfMonth('26')).to.have.class(ClassName.HIGHLIGHTED)
        })
      })
    })

    describe('disabled', () => {

      it(`should be marked with a class`, () => {
        $input.val(`2012-10-26`).datepicker({
          format: YYYY_MM_DD,
          date: {disabled: [`2012-10-01`, `2012-10-10`, `2012-10-20`]}
        })


        assertData().show()

        expect(findDayOfMonth('1')).to.have.class(ClassName.DISABLED)
        expect(findDayOfMonth('2')).not.to.have.class(ClassName.DISABLED)
        expect(findDayOfMonth('10')).to.have.class(ClassName.DISABLED)
        expect(findDayOfMonth('11')).not.to.have.class(ClassName.DISABLED)
        expect(findDayOfMonth('20')).to.have.class(ClassName.DISABLED)
        expect(findDayOfMonth('21')).not.to.have.class(ClassName.DISABLED)
      })
    })
  })
})