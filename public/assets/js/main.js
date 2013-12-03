$(document).ready(function () {
	$("#submit").hide();
	$("#submit").click(function() {
		var $form = $("#form");
		var url = $form.attr('action');
		var post = $.post(url, $("#form").serialize(), 'json').done( function(data) {
			if (data.success === true) {
				alert('Your details have been stored, Thank You');
				window.location.href = 'http://gamingforgood.net/subscriber';
			} else {
				$(':input[type="text"]').css('background-color' , '#FFFFFF');
				$(':input[type="email"]').css('background-color' , '#FFFFFF');
				for (error in data.errors) {
					$('#' + data.errors[error]).css('background-color' , '#DB4646');
				}
			}
		});		
	return false;
	});
	$("#checkboxsubmit").click(function() {
		var checked_status = this.checked;
		if (checked_status == true) {
		   $("#submit").show();
		} else {
		   $("#submit").hide();
		}
	});
	$("form").validate({ 
		rules: { 
			first_name: {
				required: true, 
			},
			phone: {
				required: true, 
			},	
			country: {
				required: true, 
			},	
			city: {
				required: true, 
			},	
			zip: {
				required: true, 
			},	
			address1: {
				required: true, 

			},				
			last_name: {
				required: true, 
			},					
			email: {
			  required: true, 
			  email: true 
			}
		   
		}, 
		showErrors: function() {
			if (this.settings.highlight) {
				for (var i = 0; this.errorList[i]; ++i) {
					this.settings.highlight.call(this, this.errorList[i].element,
						this.settings.errorClass, this.settings.validClass);
				}
			}
			if (this.settings.unhighlight) {
				for (var i = 0, elements = this.validElements(); elements[i]; ++i) {
					this.settings.unhighlight.call(this, elements[i],
						this.settings.errorClass, this.settings.validClass);
				}
			}
		},
		submitHandler: function(forms) {
				return false;
		}			  
	}); 
});