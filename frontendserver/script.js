function renderProducts1(products) {
  const productTableBody = document.getElementById("productTableBody");
  productTableBody.innerHTML = ""; // Clear existing table body
  const paginationButtons = document.getElementById("paginationButtons");
  products.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${product.id}</td>
      <td>${product.product_name}</td>
      <td>${product.brand_name}</td>
      <td>${product.category_name}</td>
      <td>${product.MRP_PRICE}</td>
      <td>${product.discount_price}</td>
      <td>${new Date(product.date_created).toLocaleDateString()}</td>
    `;
    productTableBody.appendChild(row);
    paginationButtons.innerHTML = "";
  });
}
function handleSearch(searchInput) {
  const hasNumber = /\d/.test(searchInput);
  const space = searchInput.includes(" ");
  let searchType;

  if (hasNumber) {
    searchType = "number";
  } else if (space) {
    searchType = "sentence";
  } else {
    searchType = "single";
  }

  fetch(`http://192.168.55.196:5000/category/search/${searchType}/${searchInput}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log(data);
      renderProducts1(data.products);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

function goBack() {
  window.history.back();
}

searchInput.addEventListener("input", () => {
  const searchInputValue = searchInput.value.trim();
  handleSearch(searchInputValue);
});
