function titleReplace() {
  var titleReplace = document.getElementsByClassName("titleReplace");
  console.log(titleReplace);
  for (var i = 0; i < titleReplace.length; i++) {
    var text = titleReplace[i].innerHTML;
    var result = text.replace(/_/g, " ");
    console.log(result);
    titleReplace[i].innerHTML = result;
  }
}

titleReplace();
