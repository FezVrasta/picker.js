/**
 * Helper converted from legacy code, not sure we need to keep it but for ease of conversion of the entire
 *  codebase, I've kept it.  TODO: Revisit this later to see if we actually need it.
 */
const Dates = class {
  constructor(...moments) {
    this.array = []
    this.array.push(moments)
  }

  last() {
    return this.get(-1)
  }

  length() {
    return this.array.length
  }

  push(m) {
    this.array.push(m)
  }

  get(i) {
    return this.slice(i)[0]
  }

  contains(other) {

    for (let i in this.array) {
      let m = this.array[i]
      if (m.isSame(other)) {
        return i
      }
    }

    return -1
  }

  remove(i) {
    this.array.splice(i, 1)
  }

  clear() {
    this.array = []
  }

  copy() {
    return new Dates(...this.array)
  }

  clonedArray(){
    let clones = []
    for(let m of this.array){
      clones.push(m.clone())
    }

    return clones
  }

  formattedArray(format){
    let formatted = []
    for(let m of this.array){
      formatted.push(m.format(format))
    }
    return formatted
  }
}

export default Dates
