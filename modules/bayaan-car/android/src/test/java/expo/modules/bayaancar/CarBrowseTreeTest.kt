package expo.modules.bayaancar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CarBrowseTreeTest {
  private val items = (1..10).toList()

  @Test fun slicesByPage() {
    assertEquals(listOf(1, 2, 3, 4), CarBrowseTree.slice(items, 0, 4))
    assertEquals(listOf(5, 6, 7, 8), CarBrowseTree.slice(items, 1, 4))
    assertEquals(listOf(9, 10), CarBrowseTree.slice(items, 2, 4))
  }

  @Test fun neverReturnsMoreThanPageSize() {
    assertTrue(CarBrowseTree.slice(items, 0, 3).size <= 3)
    assertTrue(CarBrowseTree.slice(items, 0, 1).size <= 1)
  }

  @Test fun outOfRangeAndHugePageSizesAreSafe() {
    assertTrue(CarBrowseTree.slice(items, 5, 4).isEmpty())
    assertTrue(CarBrowseTree.slice(items, -1, 4).isEmpty())
    assertTrue(CarBrowseTree.slice(items, 0, 0).isEmpty())
    assertEquals(items, CarBrowseTree.slice(items, 0, Int.MAX_VALUE))
    assertTrue(CarBrowseTree.slice(items, Int.MAX_VALUE, Int.MAX_VALUE).isEmpty())
  }

  @Test fun capsHugeLists() {
    val big = (1..2000).toList()
    assertEquals(500, CarBrowseTree.slice(big, 0, Int.MAX_VALUE).size)
  }
}
